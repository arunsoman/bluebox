import { create } from 'zustand';
import type { StatusType } from '@/components/StatusBadge';

export interface StageData {
  id: number;
  name: string;
  status: StatusType;
  description: string;
  progress: number;
}

export interface ActivityEvent {
  id: string;
  type: 'stage_complete' | 'stage_start' | 'stage_fail' | 'blueprint_complete' | 'steering_input' | 'system';
  title: string;
  description: string;
  timestamp: string;
  projectName?: string;
}

export interface MetricData {
  activePipelines: number;
  completedBlueprints: number;
  avgStageTime: string;
  pipelineHealth: number;
}

interface ThroughputPoint {
  time: string;
  count: number;
}

export interface PRDClassification {
  category: 'WELL_FORMED' | 'MINIMALIST' | 'SEED_ONLY';
  confidence: number;
  basis: string[];
  wordCount: number;
}

interface PipelineState {
  /* pipeline state */
  stages: StageData[];
  metrics: MetricData;
  throughputData24h: ThroughputPoint[];
  activityFeed: ActivityEvent[];
  systemStatus: {
    api: boolean;
    websocket: boolean;
    database: boolean;
    queue: boolean;
    lastSync: string;
  };

  /* PRD / session */
  hasActivePRD: boolean;
  prdText: string;
  prdClassification: PRDClassification | null;
  sessionId: string | null;
  projectId: string | null;

  /* actions */
  setStageStatus: (id: number, status: StatusType, progress?: number) => void;
  addActivity: (event: ActivityEvent) => void;
  submitPRD: (text: string) => Promise<void>;
  classifyPRD: (text: string) => PRDClassification;
  resetPRD: () => void;
  setSessionData: (sessionId: string, projectId: string) => void;
}

const STAGE_DEFS = [
  { id: 0, name: 'Intent Capture', description: 'Parse free-text user input into structured intent' },
  { id: 1, name: 'Requirement Extraction', description: 'Extract functional and non-functional requirements' },
  { id: 2, name: 'Actor Discovery', description: 'Identify all system actors and their roles' },
  { id: 3, name: 'Capability Mapping', description: 'Map actor capabilities and interactions' },
  { id: 4, name: 'Use Case Generation', description: 'Generate use cases from capabilities' },
  { id: 5, name: 'Story Derivation', description: 'Derive user stories from use cases' },
  { id: 6, name: 'Task Decomposition', description: 'Decompose stories into executable tasks' },
  { id: 7, name: 'Blueprint Assembly', description: 'Assemble final ProjectBlueprint artifact' },
];

function makeInitialStages(): StageData[] {
  return STAGE_DEFS.map((s) => ({
    ...s,
    status: 'idle' as StatusType,
    progress: 0,
  }));
}

/* safe word-count + classification */
function classifyText(text: string): PRDClassification {
  const trimmed = text.trim();
  if (!trimmed) {
    return { category: 'SEED_ONLY', confidence: 0.5, basis: ['Empty input'], wordCount: 0 };
  }
  const sample = trimmed.length > 5000 ? trimmed.slice(0, 5000) : trimmed;
  const words = sample.split(/\s+/).filter(Boolean).length;
  const hasHeaders = sample.split('\n').some((line) => /^#{1,6}\s+\w/.test(line));
  const lower = sample.toLowerCase();
  const sectionKWs = ['actor', 'requirement', 'feature', 'use case', 'story', 'architecture', 'api', 'database', 'security', 'overview', 'scope'];
  const hasSections = sectionKWs.some((kw) => lower.includes(kw));
  const hasNumbers = /\d/.test(sample);

  let category: PRDClassification['category'];
  let confidence: number;
  const basis: string[] = [];

  if (words > 500 && (hasHeaders || (hasSections && hasNumbers))) {
    category = 'WELL_FORMED';
    confidence = Math.min(0.95, 0.7 + (words > 1000 ? 0.15 : 0) + (hasHeaders ? 0.1 : 0));
    basis.push(`${words} words`);
    if (hasHeaders) basis.push('Has structural headers');
    if (hasSections) basis.push('Contains standard PRD sections');
  } else if (words >= 100) {
    category = 'MINIMALIST';
    confidence = Math.min(0.90, 0.6 + (hasSections ? 0.2 : 0) + (hasNumbers ? 0.1 : 0));
    basis.push(`${words} words`);
    if (hasSections) basis.push('Contains section keywords');
    else basis.push('Limited structural markup');
  } else {
    category = 'SEED_ONLY';
    confidence = Math.min(0.85, 0.5 + (words > 20 ? 0.2 : 0));
    basis.push(`${words} words`);
    basis.push(words < 20 ? 'Single statement' : 'Brief description');
    basis.push('Minimal detail — will require clarification');
  }
  return { category, confidence, basis, wordCount: words };
}

export const usePipelineStore = create<PipelineState>((set) => ({
  stages: makeInitialStages(),
  metrics: {
    activePipelines: 0,
    completedBlueprints: 0,
    avgStageTime: '—',
    pipelineHealth: 0,
  },
  throughputData24h: Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    count: 0,
  })),
  activityFeed: [],
  systemStatus: {
    api: false,
    websocket: false,
    database: false,
    queue: false,
    lastSync: '—',
  },
  hasActivePRD: false,
  prdText: '',
  prdClassification: null,
  sessionId: null,
  projectId: null,

  setStageStatus: (id: number, status: StatusType, progress?: number) =>
    set((state) => ({
      stages: state.stages.map((s) =>
        s.id === id ? { ...s, status, progress: progress ?? s.progress } : s
      ),
    })),

  addActivity: (event: ActivityEvent) =>
    set((state) => ({
      activityFeed: [event, ...state.activityFeed].slice(0, 50),
    })),

  submitPRD: async (text: string) => {
    const classification = classifyText(text);
    set({
      hasActivePRD: true,
      prdText: text,
      prdClassification: classification,
      stages: makeInitialStages(),
      metrics: { activePipelines: 1, completedBlueprints: 0, avgStageTime: '—', pipelineHealth: 100 },
      activityFeed: [
        {
          id: `evt-${Date.now()}`,
          type: 'system',
          title: 'Pipeline Started',
          description: `PRD submitted (${classification.wordCount} words, ${classification.category.replace('_', ' ')}) — initializing pipeline...`,
          timestamp: 'just now',
        },
      ],
    });

    /* Try to create a real backend session */
    try {
      const { createSession } = await import('@/lib/api');
      const result = await createSession(text);
      set({
        sessionId: result.session_id,
        projectId: result.project_id,
      });
      /* Advance stage 0 to running */
      set((s) => ({
        stages: s.stages.map((st) => (st.id === 0 ? { ...st, status: 'running' as StatusType, progress: 10 } : st)),
        activityFeed: [
          {
            id: `evt-${Date.now()}-s0`,
            type: 'stage_start',
            title: 'Stage 0: Intent Capture',
            description: 'Parsing PRD into structured intent...',
            timestamp: 'just now',
          },
          ...s.stages.map(() => ({} as any)).filter(() => false),
        ],
      }));
    } catch (err) {
      console.warn('[Pipeline] Backend session creation failed, running in local mode');
      /* Still show the pipeline locally */
      set((s) => ({
        sessionId: `local-${Date.now()}`,
        projectId: `proj-${Date.now()}`,
        stages: s.stages.map((st, idx) =>
          idx === 0 ? { ...st, status: 'running' as StatusType, progress: 15 } : st
        ),
      }));
    }
  },

  classifyPRD: (text: string) => classifyText(text),

  setSessionData: (sessionId: string, projectId: string) =>
    set({ sessionId, projectId }),

  resetPRD: () =>
    set({
      hasActivePRD: false,
      prdText: '',
      prdClassification: null,
      sessionId: null,
      projectId: null,
      stages: makeInitialStages(),
      metrics: { activePipelines: 0, completedBlueprints: 0, avgStageTime: '—', pipelineHealth: 0 },
      activityFeed: [],
    }),
}));
