import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface WebSocketState {
  status: ConnectionStatus;
  currentPipelineState: string | null;
  currentStage: number | null;
  blueprintData: object | null;

  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: object) => void;
  setStatus: (status: ConnectionStatus) => void;
  setPipelineState: (state: string) => void;
  setCurrentStage: (stage: number) => void;
  setBlueprintData: (data: object) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  status: 'connected',
  currentPipelineState: null,
  currentStage: null,
  blueprintData: null,

  connect: () => {
    set({ status: 'connecting' });
    // Simulate connection
    setTimeout(() => {
      set({ status: 'connected' });
    }, 1000);
  },

  disconnect: () => {
    set({ status: 'disconnected' });
  },

  sendMessage: (message: object) => {
    console.log('WebSocket send:', message);
  },

  setStatus: (status: ConnectionStatus) => set({ status }),
  setPipelineState: (state: string) => set({ currentPipelineState: state }),
  setCurrentStage: (stage: number) => set({ currentStage: stage }),
  setBlueprintData: (data: object) => set({ blueprintData: data }),
}));
