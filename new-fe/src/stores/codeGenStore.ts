import { create } from "zustand";
import { codeGenApi } from "@/api/endpoints/codeGen";
import { socketClient } from "@/ws/socketClient";

interface CodeGenState {
  projectId: string | null;
  tasks: TaskGenerationStatus[];
  paused: boolean;
  loading: boolean;
  unsubscribe: (() => void) | null;
  init: (projectId: string) => void;
  startAll: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  runTask: (taskId: string) => Promise<void>;
  teardown: () => void;
}

/**
 * Backs the code-generation progress panel - NOT part of
 * doc/api_event_contract.md §8.1 (no per-task or pause concept there); see
 * `TaskGenerationStatus`'s doc comment. Tab-switchable panel meant to
 * survive tab switches, so `init()` is idempotent and called once from
 * `CodeGenerationPanel` - never torn down on unmount (same convention as
 * `steeringStore`).
 */
export const useCodeGenStore = create<CodeGenState>((set, get) => ({
  projectId: null,
  tasks: [],
  paused: false,
  loading: false,
  unsubscribe: null,

  init: (projectId) => {
    if (get().projectId === projectId) return;
    get().unsubscribe?.();
    set({ projectId, tasks: [], paused: false, loading: true });

    codeGenApi
      .listTasks(projectId)
      .then((tasks) => set({ tasks }))
      .finally(() => set({ loading: false }));

    const unsubscribers = [
      socketClient.on("CODE_GENERATION_STARTED", () => {
        set({ paused: false });
        void codeGenApi.listTasks(projectId).then((tasks) => set({ tasks }));
      }),
      socketClient.on("CODE_TASK_STATUS", (task) => {
        set((s) => {
          const index = s.tasks.findIndex((t) => t.task_id === task.task_id);
          if (index === -1) return { tasks: [...s.tasks, task] };
          const next = [...s.tasks];
          next[index] = task;
          return { tasks: next };
        });
      }),
    ];
    set({ unsubscribe: () => unsubscribers.forEach((u) => u()) });
  },

  startAll: async () => {
    const { projectId } = get();
    if (!projectId) return;
    await codeGenApi.start(projectId, { include_tests: true, include_infrastructure: true });
    set({ paused: false });
  },

  pause: async () => {
    const { projectId } = get();
    if (!projectId) return;
    await codeGenApi.pause(projectId);
    set({ paused: true });
  },

  resume: async () => {
    const { projectId } = get();
    if (!projectId) return;
    await codeGenApi.resume(projectId);
    set({ paused: false });
  },

  stop: async () => {
    const { projectId } = get();
    if (!projectId) return;
    await codeGenApi.cancel(projectId);
    set({ paused: false });
  },

  runTask: async (taskId) => {
    const { projectId } = get();
    if (!projectId) return;
    await codeGenApi.runTask(projectId, taskId);
  },

  teardown: () => {
    get().unsubscribe?.();
    set({ projectId: null, tasks: [], paused: false, unsubscribe: null });
  },
}));
