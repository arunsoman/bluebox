/**
 * Entity type definitions for the pipeline blueprint.
 * These types represent the structured output from the 8-stage pipeline.
 */

export type EntityType = 'actor' | 'capability' | 'use-case' | 'story' | 'task';

export type ActorType = 'human' | 'system' | 'external';
export type EntityStatus = 'generated' | 'validated' | 'modified' | 'rejected';

export interface BaseEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  tags: string[];
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Actor extends BaseEntity {
  type: 'actor';
  actorType: ActorType;
  role: string;
  responsibilities: string[];
}

export interface Capability extends BaseEntity {
  type: 'capability';
  linkedActors: string[];
  features: string[];
}

export interface UseCase extends BaseEntity {
  type: 'use-case';
  linkedCapabilities: string[];
  preconditions: string[];
  postconditions: string[];
}

export interface UserStory extends BaseEntity {
  type: 'story';
  linkedUseCase: string | null;
  acceptanceCriteria: string[];
  entities: { name: string; type: string; description: string }[];
  externalInterfaces: { name: string; type: string; is_external: boolean }[];
  storyPoints: number | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
};

export interface Task extends BaseEntity {
  type: 'task';
  linkedStory: string | null;
  taskType: string;
  contract: {
    pre: string[];
    post: string[];
    inv: string[];
    frame: string[];
    live: string;
  };
  estimatedHours: number | null;
  dependencies: string[];
  assignee: string;
}

export type Entity = Actor | Capability | UseCase | UserStory | Task;

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: 'depends' | 'implements' | 'performs' | 'derives';
}

/** Empty defaults — real data comes from the pipeline store */
export const allEntities: Entity[] = [];
export const graphNodes: GraphNode[] = [];
export const graphEdges: GraphEdge[] = [];

/** Convert a backend ProjectBlueprint-shaped object into frontend Entity[] */
export function blueprintToEntities(blueprint: object | null | undefined): Entity[] {
  if (!blueprint) return [];
  const bp = blueprint as Record<string, any>;
  const now = new Date().toISOString();

  const actors: Actor[] = (bp.actors || []).map((a: any) => ({
    id: a.id || `actor-${Math.random().toString(36).slice(2)}`,
    name: a.name || a.title || 'Unnamed Actor',
    type: 'actor' as const,
    description: a.description || '',
    tags: a.parent_ids || [],
    status: (a.state === 'user_defined' ? 'validated' : a.state === 'superseded' ? 'rejected' : 'generated') as EntityStatus,
    createdAt: a.created_at || now,
    updatedAt: a.updated_at || now,
    actorType: (a.type === 'human' || a.type === 'system' || a.type === 'external' ? a.type : 'human') as ActorType,
    role: a.role || '',
    responsibilities: a.responsibilities || [],
  }));

  const capabilities: Capability[] = (bp.capabilities || []).map((c: any) => ({
    id: c.id || `cap-${Math.random().toString(36).slice(2)}`,
    name: c.name || c.title || 'Unnamed Capability',
    type: 'capability' as const,
    description: c.description || '',
    tags: (c.actor_ids || []).map((id: string) => {
      const actor = actors.find((a) => a.id === id);
      return actor ? actor.name : id;
    }),
    status: (c.state === 'user_defined' ? 'validated' : c.state === 'superseded' ? 'rejected' : 'generated') as EntityStatus,
    createdAt: c.created_at || now,
    updatedAt: c.updated_at || now,
    linkedActors: c.actor_ids || [],
    features: c.features || [],
  }));

  const useCases: UseCase[] = (bp.use_cases || []).map((u: any) => ({
    id: u.id || `uc-${Math.random().toString(36).slice(2)}`,
    name: u.name || u.title || 'Unnamed Use Case',
    type: 'use-case' as const,
    description: u.description || '',
    tags: (u.actor_ids || []).map((id: string) => {
      const actor = actors.find((a) => a.id === id);
      return actor ? actor.name : id;
    }),
    status: (u.state === 'user_defined' ? 'validated' : u.state === 'superseded' ? 'rejected' : 'generated') as EntityStatus,
    createdAt: u.created_at || now,
    updatedAt: u.updated_at || now,
    linkedCapabilities: u.capability_ids || [],
    preconditions: u.preconditions || [],
    postconditions: u.postconditions || [],
  }));

  const stories: UserStory[] = (bp.user_stories || []).map((s: any) => ({
    id: s.id || `story-${Math.random().toString(36).slice(2)}`,
    name: s.title || s.name || 'Unnamed Story',
    type: 'story' as const,
    description: s.description || '',
    tags: (s.actor_ids || []).map((id: string) => {
      const actor = actors.find((a) => a.id === id);
      return actor ? actor.name : id;
    }),
    status: (s.state === 'user_defined' ? 'validated' : s.state === 'superseded' ? 'rejected' : 'generated') as EntityStatus,
    createdAt: s.created_at || now,
    updatedAt: s.updated_at || now,
    linkedUseCase: s.use_case_ids?.[0] || null,
    acceptanceCriteria: s.acceptance_criteria || [],
    entities: s.entities || [],
    externalInterfaces: s.external_interfaces || [],
    storyPoints: s.points ?? null,
    priority: (s.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
  }));

  const tasks: Task[] = (bp.task_decomposition || []).map((t: any) => ({
    id: t.id || `task-${Math.random().toString(36).slice(2)}`,
    name: t.title || t.name || 'Unnamed Task',
    type: 'task' as const,
    description: t.description || '',
    tags: t.access_guards || [],
    status: (t.state === 'user_defined' ? 'validated' : t.state === 'superseded' ? 'rejected' : 'generated') as EntityStatus,
    createdAt: t.created_at || now,
    updatedAt: t.updated_at || now,
    linkedStory: t.story_ids?.[0] || null,
    taskType: t.task_type || t.type || 'general',
    contract: t.contract || { pre: [], post: [], inv: [], frame: [], live: '' },
    estimatedHours: t.estimated_hours ?? null,
    dependencies: t.dependencies || [],
    assignee: '',
  }));

  return [...actors, ...capabilities, ...useCases, ...stories, ...tasks];
}

export function getEntitiesByType(type: EntityType): Entity[] {
  return allEntities.filter((e) => e.type === type);
}

export function getEntityById(id: string): Entity | undefined {
  return allEntities.find((e) => e.id === id);
}

export function searchEntities(query: string): Entity[] {
  return allEntities.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase())
  );
}
