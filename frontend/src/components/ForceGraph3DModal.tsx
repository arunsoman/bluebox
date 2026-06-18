import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Box } from 'lucide-react';
import { ForceGraph3D, type Graph3DNode } from './ForceGraph3D';
import type { Entity } from '@/data/entityTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  entities: Entity[];
  projectName: string;
}

/**
 * Build hierarchical graph from entities.
 *
 * Hierarchy:  Project → Actors → Capabilities → Use Cases → Stories → Tasks
 * Each child type links to its parent via the entity relationship fields
 * (linkedActors, linkedCapabilities, linkedUseCase, linkedStory).
 *
 * Returns the root node (project) with nested children.
 */
function buildHierarchicalGraph(entities: Entity[], projectName: string): Graph3DNode {
  const actors = entities.filter((e) => e.type === 'actor');
  const capabilities = entities.filter((e) => e.type === 'capability');
  const useCases = entities.filter((e) => e.type === 'use-case');
  const stories = entities.filter((e) => e.type === 'story');
  const tasks = entities.filter((e) => e.type === 'task');

  // Build task → story links
  const tasksByStory = new Map<string, Entity[]>();
  tasks.forEach((t) => {
    if (t.linkedStory) {
      const list = tasksByStory.get(t.linkedStory) || [];
      list.push(t);
      tasksByStory.set(t.linkedStory, list);
    }
  });

  // Build story → use case links
  const storiesByUseCase = new Map<string, Entity[]>();
  stories.forEach((s) => {
    if (s.linkedUseCase) {
      const list = storiesByUseCase.get(s.linkedUseCase) || [];
      list.push(s);
      storiesByUseCase.set(s.linkedUseCase, list);
    }
  });

  // Build use case → capability links
  const useCasesByCapability = new Map<string, Entity[]>();
  useCases.forEach((u) => {
    u.linkedCapabilities.forEach((capId) => {
      const list = useCasesByCapability.get(capId) || [];
      list.push(u);
      useCasesByCapability.set(capId, list);
    });
  });

  // Build capability → actor links
  const capabilitiesByActor = new Map<string, Entity[]>();
  capabilities.forEach((c) => {
    c.linkedActors.forEach((actorId) => {
      const list = capabilitiesByActor.get(actorId) || [];
      list.push(c);
      capabilitiesByActor.set(actorId, list);
    });
  });

  // Build hierarchical nodes
  const root: Graph3DNode = {
    id: 'project-root',
    label: projectName || 'Project',
    type: 'project',
    children: [],
  };

  // For each actor, build its subtree
  actors.forEach((actor) => {
    const actorNode: Graph3DNode = {
      id: actor.id,
      label: actor.name,
      type: 'actor',
      data: {
        description: actor.description,
        state: actor.status,
      },
      children: [],
    };

    // Get capabilities for this actor
    const actorCaps = capabilitiesByActor.get(actor.id) || [];
    actorCaps.forEach((cap) => {
      const capNode: Graph3DNode = {
        id: cap.id,
        label: cap.name,
        type: 'capability',
        data: {
          description: cap.description,
          state: cap.status,
        },
        children: [],
      };

      // Get use cases for this capability
      const capUCs = useCasesByCapability.get(cap.id) || [];
      capUCs.forEach((uc) => {
        const ucNode: Graph3DNode = {
          id: uc.id,
          label: uc.name,
          type: 'use-case',
          data: {
            description: uc.description,
            state: uc.status,
          },
          children: [],
        };

        // Get stories for this use case
        const ucStories = storiesByUseCase.get(uc.id) || [];
        ucStories.forEach((story) => {
          const storyNode: Graph3DNode = {
            id: story.id,
            label: story.name,
            type: 'story',
            data: {
              description: story.description,
              state: story.status,
            },
            children: [],
          };

          // Get tasks for this story
          const storyTasks = tasksByStory.get(story.id) || [];
          storyTasks.forEach((task) => {
            const taskNode: Graph3DNode = {
              id: task.id,
              label: task.name,
              type: 'task',
              data: {
                description: task.description,
                state: task.status,
              },
            };
            storyNode.children!.push(taskNode);
          });

          ucNode.children!.push(storyNode);
        });

        capNode.children!.push(ucNode);
      });

      actorNode.children!.push(capNode);
    });

    root.children!.push(actorNode);
  });

  // Handle orphan entities (not linked to any parent)
  // Add orphan capabilities directly under root
  const linkedCapIds = new Set<string>();
  capabilitiesByActor.forEach((caps) => caps.forEach((c) => linkedCapIds.add(c.id)));
  capabilities
    .filter((c) => !linkedCapIds.has(c.id))
    .forEach((cap) => {
      const capNode: Graph3DNode = {
        id: cap.id,
        label: cap.name,
        type: 'capability',
        data: { description: cap.description, state: cap.status },
        children: [],
      };

      // Add orphan use cases under this capability
      const capUCs = useCasesByCapability.get(cap.id) || [];
      capUCs.forEach((uc) => {
        const ucNode: Graph3DNode = {
          id: uc.id,
          label: uc.name,
          type: 'use-case',
          data: { description: uc.description, state: uc.status },
          children: [],
        };
        capNode.children!.push(ucNode);
      });

      root.children!.push(capNode);
    });

  // Handle orphan use cases (not linked to any capability)
  const linkedUcIds = new Set<string>();
  useCasesByCapability.forEach((ucs) => ucs.forEach((u) => linkedUcIds.add(u.id)));
  useCases
    .filter((uc) => !linkedUcIds.has(uc.id))
    .forEach((uc) => {
      const ucNode: Graph3DNode = {
        id: uc.id,
        label: uc.name,
        type: 'use-case',
        data: { description: uc.description, state: uc.status },
        children: [],
      };

      // Add orphan stories under this use case
      const ucStories = storiesByUseCase.get(uc.id) || [];
      ucStories.forEach((story) => {
        const storyNode: Graph3DNode = {
          id: story.id,
          label: story.name,
          type: 'story',
          data: { description: story.description, state: story.status },
          children: [],
        };
        ucNode.children!.push(storyNode);
      });

      root.children!.push(ucNode);
    });

  // Handle orphan stories (not linked to any use case)
  const linkedStoryIds = new Set<string>();
  storiesByUseCase.forEach((stories) => stories.forEach((s) => linkedStoryIds.add(s.id)));
  stories
    .filter((s) => !linkedStoryIds.has(s.id))
    .forEach((story) => {
      const storyNode: Graph3DNode = {
        id: story.id,
        label: story.name,
        type: 'story',
        data: { description: story.description, state: story.status },
        children: [],
      };

      // Add tasks under this story
      const storyTasks = tasksByStory.get(story.id) || [];
      storyTasks.forEach((task) => {
        const taskNode: Graph3DNode = {
          id: task.id,
          label: task.name,
          type: 'task',
          data: {
            description: task.description,
            state: task.status,
          },
        };
        storyNode.children!.push(taskNode);
      });

      root.children!.push(storyNode);
    });

  // Handle orphan tasks (not linked to any story)
  const linkedTaskIds = new Set<string>();
  tasksByStory.forEach((tasks) => tasks.forEach((t) => linkedTaskIds.add(t.id)));
  tasks
    .filter((t) => !linkedTaskIds.has(t.id) && !t.linkedStory)
    .forEach((task) => {
      const taskNode: Graph3DNode = {
        id: task.id,
        label: task.name,
        type: 'task',
        data: {
          description: task.description,
          state: task.status,
        },
      };
      root.children!.push(taskNode);
    });

  return root;
}

const LEGEND = [
  { type: 'Project', color: '#00F5FF' },
  { type: 'Actor', color: '#00F5FF' },
  { type: 'Capability', color: '#7B2FFF' },
  { type: 'Use Case', color: '#39FF14' },
  { type: 'Story', color: '#FFB800' },
  { type: 'Task', color: '#8BA4C7' },
];

export default function ForceGraph3DModal({ open, onClose, entities, projectName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3D | null>(null);
  const [selectedNode, setSelectedNode] = useState<Graph3DNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  const handleNodeClick = useCallback((node: Graph3DNode) => {
    setSelectedNode(node);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    // Wait a tick for the modal to layout, then init
    const initTimer = setTimeout(() => {
      if (!containerRef.current) return;
      const graph = new ForceGraph3D(containerRef.current, handleNodeClick);
      graphRef.current = graph;
      const root = buildHierarchicalGraph(entities, projectName);

      // Count nodes in hierarchy
      const countNodes = (n: Graph3DNode): number => 1 + (n.children?.reduce((s, c) => s + countNodes(c), 0) || 0);
      setNodeCount(countNodes(root));

      graph.setHierarchicalData(root);
      graph.start();
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = null;
      }
    };
  }, [open, entities, projectName, handleNodeClick]);

  // Resize observer
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      graphRef.current?.resize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
            className="relative w-[90vw] h-[85vh] max-w-[1400px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8,15,31,0.95)',
              border: '1px solid rgba(0,245,255,0.2)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(0,245,255,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[rgba(138,180,230,0.08)]"
              style={{ background: 'rgba(8,15,31,0.8)', backdropFilter: 'blur(20px)' }}
            >
              <div className="flex items-center gap-3">
                <Box size={20} style={{ color: '#00F5FF' }} />
                <h2 className="font-display-md text-[#E8F0FE] text-lg">3D Blueprint Graph</h2>
                <span className="font-mono-sm text-[#4A6487] text-xs">
                  {nodeCount} nodes
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Legend */}
                <div className="hidden md:flex items-center gap-3 mr-4">
                  {LEGEND.map((item) => (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}66` }}
                      />
                      <span className="text-[10px] text-[#8BA4C7] font-body-sm">{item.type}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (graphRef.current && containerRef.current) {
                      graphRef.current.dispose();
                      const g = new ForceGraph3D(containerRef.current, handleNodeClick);
                      graphRef.current = g;
                      const root = buildHierarchicalGraph(entities, projectName);
                      g.setHierarchicalData(root);
                      g.start();
                    }
                  }}
                  className="p-2 rounded-lg glass-clear hover:glass-tinted transition-all"
                  title="Reset view"
                >
                  <RotateCcw size={16} className="text-[#8BA4C7]" />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg glass-clear hover:glass-tinted transition-all"
                  title="Close"
                >
                  <X size={18} className="text-[#8BA4C7]" />
                </button>
              </div>
            </div>

            {/* 3D Canvas Container */}
            <div
              ref={containerRef}
              className="absolute inset-0"
              style={{ cursor: 'grab' }}
            />

            {/* Instructions overlay */}
            <div className="absolute bottom-4 left-4 z-20 glass-frosted rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-4 text-[10px] text-[#4A6487] font-mono-sm">
                <span><span className="text-[#00F5FF]">Drag</span> — Rotate</span>
                <span><span className="text-[#00F5FF]">Scroll</span> — Zoom</span>
                <span><span className="text-[#00F5FF]">Shift+Drag</span> — Pan</span>
                <span><span className="text-[#00F5FF]">Click node</span> — Select</span>
              </div>
            </div>

            {/* Selected node info */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.25 }}
                  className="absolute top-20 right-4 z-20 w-64 glass-elevated rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body-sm text-[#4A6487] text-[10px] uppercase tracking-wider">
                      Selected Node
                    </span>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1 rounded hover:bg-white/5"
                    >
                      <X size={12} className="text-[#4A6487]" />
                    </button>
                  </div>
                  <h3 className="font-heading-sm text-[#E8F0FE] text-sm mb-1">{selectedNode.label}</h3>
                  <span
                    className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{
                      color: LEGEND.find((l) => l.type.toLowerCase().replace(' ', '-') === selectedNode.type)?.color || '#00F5FF',
                      background: 'rgba(10,22,40,0.5)',
                      border: '1px solid rgba(138,180,230,0.1)',
                    }}
                  >
                    {selectedNode.type.toUpperCase()}
                  </span>
                  {selectedNode.data?.description && (
                    <p className="font-body-sm text-[#8BA4C7] text-[11px] mt-2 line-clamp-3">
                      {selectedNode.data.description}
                    </p>
                  )}
                  {selectedNode.data?.taskType && (
                    <p className="font-mono-sm text-[#4A6487] text-[10px] mt-1">
                      Type: {selectedNode.data.taskType}
                    </p>
                  )}
                  <p className="font-mono-sm text-[#4A6487] text-[10px] mt-2">ID: {selectedNode.id}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {nodeCount === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Box size={48} className="mx-auto mb-3 text-[#4A6487]" />
                  <p className="font-heading-sm text-[#8BA4C7]">No blueprint data</p>
                  <p className="font-body-sm text-[#4A6487] mt-1">
                    Run a pipeline to generate the blueprint graph
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}