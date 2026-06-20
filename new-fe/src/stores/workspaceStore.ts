import { create } from "zustand";
import { socketClient } from "@/ws/socketClient";
import { workspaceApi } from "@/api/endpoints/workspace";
import { useMergeConflictStore } from "@/stores/mergeConflictStore";

export interface OpenTab {
  path: string;
  content: string;
  language: string;
  version: string;
  isModified: boolean;
  isGenerating: boolean;
  /** Content as last loaded/saved — the "base" of a 3-way merge if regeneration arrives while isModified. */
  baseContent: string;
}

interface WorkspaceState {
  projectId: string | null;
  tree: FileNode | null;
  loadingTree: boolean;
  statusOverrides: Map<string, FileNodeStatus>;
  openTabs: OpenTab[];
  activeTabPath: string | null;
  unsubscribe: (() => void) | null;
  init: (projectId: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  applyMergedContent: (path: string, content: string) => void;
  teardown: () => void;
}

function setNodeStatus(node: FileNode, path: string, status: FileNodeStatus): FileNode {
  if (node.path === path) return { ...node, status };
  if (!node.children) return node;
  return { ...node, children: node.children.map((c) => setNodeStatus(c, path, status)) };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectId: null,
  tree: null,
  loadingTree: false,
  statusOverrides: new Map(),
  openTabs: [],
  activeTabPath: null,
  unsubscribe: null,

  init: async (projectId) => {
    if (get().projectId === projectId) return;
    get().unsubscribe?.();
    set({ projectId, tree: null, openTabs: [], activeTabPath: null });
    await get().refreshTree();

    const unsubscribers = [
      socketClient.on("CODE_FILE_STREAM", (chunk) => {
        set((s) => ({
          tree: s.tree ? setNodeStatus(s.tree, chunk.file_path, "generating") : s.tree,
          openTabs: s.openTabs.map((tab) =>
            tab.path === chunk.file_path && !tab.isModified
              ? { ...tab, content: tab.content + chunk.content_delta, isGenerating: true }
              : tab,
          ),
        }));
      }),
      socketClient.on("CODE_FILE_COMPLETE", (file) => {
        const conflictedTab = get().openTabs.find((t) => t.path === file.file_path && t.isModified);
        if (conflictedTab) {
          // Regeneration landed while the user had unsaved local edits —
          // doc/phase-1-wireframe.md §14.2 ("Blueprint revision triggered
          // regeneration. User edits detected.") — surface the 3-way merge
          // instead of silently clobbering either version.
          useMergeConflictStore.getState().show({
            file_path: file.file_path,
            base: conflictedTab.baseContent,
            ours: conflictedTab.content,
            theirs: file.content,
          });
          set((s) => ({ tree: s.tree ? setNodeStatus(s.tree, file.file_path, "conflict") : s.tree }));
          return;
        }
        set((s) => ({
          tree: s.tree ? setNodeStatus(s.tree, file.file_path, "complete") : s.tree,
          openTabs: s.openTabs.map((tab) =>
            tab.path === file.file_path
              ? { ...tab, content: file.content, baseContent: file.content, language: file.language, isGenerating: false }
              : tab,
          ),
        }));
        void get().refreshTree();
      }),
      socketClient.on("CODE_FILE_MODIFIED", ({ file_path }) => {
        set((s) => ({ tree: s.tree ? setNodeStatus(s.tree, file_path, "modified") : s.tree }));
      }),
      socketClient.on("FILE_STATUS_CHANGED", ({ file_path, new_status }) => {
        set((s) => ({ tree: s.tree ? setNodeStatus(s.tree, file_path, new_status) : s.tree }));
      }),
    ];
    set({ unsubscribe: () => unsubscribers.forEach((u) => u()) });
  },

  refreshTree: async () => {
    const { projectId } = get();
    if (!projectId) return;
    set({ loadingTree: true });
    try {
      const { root } = await workspaceApi.listFiles(projectId, { include_generated: true, include_user_edited: true });
      set({ tree: root });
    } finally {
      set({ loadingTree: false });
    }
  },

  openFile: async (path) => {
    const { projectId, openTabs } = get();
    if (!projectId) return;
    if (openTabs.some((t) => t.path === path)) {
      set({ activeTabPath: path });
      return;
    }
    const file = await workspaceApi.readFile(projectId, { path });
    set((s) => ({
      openTabs: [
        ...s.openTabs,
        {
          path,
          content: file.content,
          baseContent: file.content,
          language: file.language,
          version: file.version,
          isModified: false,
          isGenerating: false,
        },
      ],
      activeTabPath: path,
    }));
  },

  closeFile: (path) =>
    set((s) => {
      const remaining = s.openTabs.filter((t) => t.path !== path);
      return {
        openTabs: remaining,
        activeTabPath:
          s.activeTabPath === path ? remaining[remaining.length - 1]?.path ?? null : s.activeTabPath,
      };
    }),

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.path === path ? { ...t, content, isModified: true } : t)),
    })),

  saveFile: async (path) => {
    const { projectId, openTabs } = get();
    const tab = openTabs.find((t) => t.path === path);
    if (!projectId || !tab) return;
    const saved = await workspaceApi.writeFile(projectId, { path, content: tab.content, source: "user_edit" });
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === path
          ? { ...t, content: saved.content, baseContent: saved.content, version: saved.version, isModified: false }
          : t,
      ),
    }));
  },

  /** Applied by MergeConflictModal once the architect resolves a 3-way conflict. */
  applyMergedContent: (path, content) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === path ? { ...t, content, baseContent: content, isModified: false, isGenerating: false } : t,
      ),
      tree: s.tree ? setNodeStatus(s.tree, path, "complete") : s.tree,
    })),

  teardown: () => {
    get().unsubscribe?.();
    set({ projectId: null, tree: null, openTabs: [], activeTabPath: null, unsubscribe: null });
  },
}));
