import { create } from 'zustand';
import { WS_URL, FEATURES } from '@/lib/config';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface WebSocketState {
  status: ConnectionStatus;
  currentPipelineState: string | null;
  currentStage: number | null;
  blueprintData: object | null;
  socket: WebSocket | null;
  logs: PipelineLog[];
  isRunning: boolean;
  isPaused: boolean;
  progress: number;

  connect: (sessionId: string) => void;
  disconnect: () => void;
  sendMessage: (message: object) => void;
  startPipeline: () => void;
  pausePipeline: () => void;
  resumePipeline: () => void;
  addLog: (log: PipelineLog) => void;
  clearLogs: () => void;
  setStatus: (status: ConnectionStatus) => void;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  stageId: number;
  severity: 'info' | 'success' | 'warning' | 'error' | 'stage';
  message: string;
  data?: object;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  status: 'disconnected',
  currentPipelineState: null,
  currentStage: null,
  blueprintData: null,
  socket: null,
  logs: [],
  isRunning: false,
  isPaused: false,
  progress: 0,

  connect: (sessionId: string) => {
    if (!FEATURES.liveWebSocket) {
      set({ status: 'connected' });
      return;
    }

    const wsUrl = `${WS_URL}/steering/${sessionId}`;

    try {
      set({ status: 'connecting' });
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ status: 'connected', socket });
        // Do NOT send START_PIPELINE here — wait for STEERING_PANEL_READY from server
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const data = msg.data || {};

          // Send START_PIPELINE after server signals it's ready
          if (msg.event === 'STEERING_PANEL_READY' && !data.type) {
            socket.send(JSON.stringify({ event: 'START_PIPELINE' }));
            set({ isRunning: true });
            return;
          }

          if (msg.event === 'CHUNK_STREAM') {
            if (data.type === 'stage_start') {
              get().addLog({
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                stageId: msg.stage_id || 0,
                severity: 'stage',
                message: data.message || `Stage ${msg.stage_id} started`,
              });
              set({ currentStage: msg.stage_id });
            } else if (data.type === 'chunk') {
              get().addLog({
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                stageId: msg.stage_id || 0,
                severity: 'info',
                message: data.message || JSON.stringify(data),
                data,
              });
            } else {
              get().addLog({
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                stageId: msg.stage_id || 0,
                severity: 'info',
                message: data.message || JSON.stringify(data),
              });
            }
          } else if (msg.event === 'STEERING_PANEL_READY' && data.type === 'pipeline_complete') {
            const blueprint = data.blueprint || null;
            set({
              isRunning: false,
              progress: 100,
              currentStage: null,
              blueprintData: blueprint,
            });
            get().addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              stageId: 7,
              severity: 'success',
              message: data.message || 'Pipeline complete — Blueprint assembled',
              data,
            });
          } else if (msg.event === 'STEERING_PANEL_READY' && data.type === 'stage_complete') {
            get().addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              stageId: msg.stage_id || 0,
              severity: 'success',
              message: data.message || `Stage ${msg.stage_id} complete`,
              data,
            });
            set({
              currentStage: (msg.stage_id || 0) + 1,
              progress: Math.min(100, ((msg.stage_id || 0) + 1) / 8 * 100),
            });
          } else if (msg.event === 'STEERING_REQUIRED') {
            get().addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              stageId: msg.stage_id || 0,
              severity: 'warning',
              message: data.message || 'Steering required',
              data,
            });
            set({ isRunning: false, isPaused: true });
          } else if (msg.event === 'ERROR') {
            get().addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              stageId: 0,
              severity: 'error',
              message: data.message || 'Unknown error',
            });
            set({ isRunning: false });
          }
        } catch {
          /* non-JSON message */
        }
      };

      socket.onclose = () => {
        set({ status: 'disconnected', socket: null, isRunning: false });
      };

      socket.onerror = () => {
        set({ status: 'disconnected', socket: null, isRunning: false });
      };
    } catch {
      set({ status: 'disconnected' });
    }
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
    }
    set({ status: 'disconnected', socket: null, isRunning: false });
  },

  sendMessage: (message: object) => {
    const { socket, status } = get();
    if (socket && status === 'connected') {
      socket.send(JSON.stringify(message));
    }
  },

  startPipeline: () => {
    const { socket, status } = get();
    if (socket && status === 'connected') {
      socket.send(JSON.stringify({ event: 'START_PIPELINE' }));
      set({ isRunning: true, isPaused: false });
    }
  },

  pausePipeline: () => {
    const { socket, status } = get();
    if (socket && status === 'connected') {
      socket.send(JSON.stringify({ event: 'PAUSE_PIPELINE' }));
      set({ isPaused: true });
    }
  },

  resumePipeline: () => {
    const { socket, status } = get();
    if (socket && status === 'connected') {
      socket.send(JSON.stringify({ event: 'RESUME_PIPELINE' }));
      set({ isPaused: false, isRunning: true });
    }
  },

  addLog: (log: PipelineLog) =>
    set((state) => ({
      logs: [...state.logs, log].slice(-500),
    })),

  clearLogs: () => set({ logs: [] }),

  setStatus: (status: ConnectionStatus) => set({ status }),
}));
