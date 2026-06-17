import { create } from 'zustand';
import type { StatusType } from '@/components/StatusBadge';

export interface StageData {
  id: number;
  name: string;
  status: StatusType;
  description: string;
  progress: number;
  runsToday: number;
  avgTime: string;
  successRate: number;
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
  avgStageTimeMs: number;
  pipelineHealth: number;
  pipelineHealthDelta: number;
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
  stages: StageData[];
  metrics: MetricData;
  throughputData24h: ThroughputPoint[];
  throughputData7d: ThroughputPoint[];
  throughputData30d: ThroughputPoint[];
  activityFeed: ActivityEvent[];
  systemStatus: {
    api: boolean;
    websocket: boolean;
    database: boolean;
    queue: boolean;
    lastSync: string;
  };
  hasActivePRD: boolean;
  prdText: string;
  prdClassification: PRDClassification | null;

  setStageStatus: (id: number, status: StatusType, progress?: number) => void;
  addActivity: (event: ActivityEvent) => void;
  submitPRD: (text: string) => void;
  classifyPRD: (text: string) => PRDClassification;
  resetPRD: () => void;
}

const initialStages: StageData[] = [
  {
    id: 0,
    name: 'Intent Capture',
    status: 'completed',
    description: 'Parse free-text user input into structured intent',
    progress: 100,
    runsToday: 12,
    avgTime: '14s',
    successRate: 98,
  },
  {
    id: 1,
    name: 'Requirement Extraction',
    status: 'completed',
    description: 'Extract functional and non-functional requirements',
    progress: 100,
    runsToday: 10,
    avgTime: '28s',
    successRate: 95,
  },
  {
    id: 2,
    name: 'Actor Discovery',
    status: 'running',
    description: 'Identify all system actors and their roles',
    progress: 68,
    runsToday: 8,
    avgTime: '1m 12s',
    successRate: 92,
  },
  {
    id: 3,
    name: 'Capability Mapping',
    status: 'idle',
    description: 'Map actor capabilities and interactions',
    progress: 0,
    runsToday: 6,
    avgTime: '45s',
    successRate: 88,
  },
  {
    id: 4,
    name: 'Use Case Generation',
    status: 'idle',
    description: 'Generate use cases from capabilities',
    progress: 0,
    runsToday: 6,
    avgTime: '52s',
    successRate: 90,
  },
  {
    id: 5,
    name: 'Story Derivation',
    status: 'idle',
    description: 'Derive user stories from use cases',
    progress: 0,
    runsToday: 4,
    avgTime: '38s',
    successRate: 85,
  },
  {
    id: 6,
    name: 'Task Decomposition',
    status: 'idle',
    description: 'Decompose stories into executable tasks',
    progress: 0,
    runsToday: 4,
    avgTime: '1m 05s',
    successRate: 82,
  },
  {
    id: 7,
    name: 'Blueprint Assembly',
    status: 'idle',
    description: 'Assemble final ProjectBlueprint artifact',
    progress: 0,
    runsToday: 3,
    avgTime: '22s',
    successRate: 97,
  },
];

const initialActivityFeed: ActivityEvent[] = [
  {
    id: '1',
    type: 'stage_start',
    title: 'Stage 2 Started',
    description: 'Actor Discovery started for "E-Commerce Platform" project',
    timestamp: '2m ago',
    projectName: 'E-Commerce Platform',
  },
  {
    id: '2',
    type: 'stage_complete',
    title: 'Stage 1 Completed',
    description: 'Requirement Extraction finished for "E-Commerce Platform" project',
    timestamp: '5m ago',
    projectName: 'E-Commerce Platform',
  },
  {
    id: '3',
    type: 'stage_complete',
    title: 'Stage 0 Completed',
    description: 'Intent Capture finished for "E-Commerce Platform" project',
    timestamp: '8m ago',
    projectName: 'E-Commerce Platform',
  },
  {
    id: '4',
    type: 'steering_input',
    title: 'Steering Input Received',
    description: 'User approved actor list at Stage 2 for "E-Commerce Platform"',
    timestamp: '12m ago',
    projectName: 'E-Commerce Platform',
  },
  {
    id: '5',
    type: 'blueprint_complete',
    title: 'Blueprint Generated',
    description: 'Blueprint generated for "Inventory API" project — 98% confidence',
    timestamp: '1h ago',
    projectName: 'Inventory API',
  },
  {
    id: '6',
    type: 'stage_fail',
    title: 'Stage 4 Failed',
    description: 'Use Case Generation failed for "Legacy Migration" — manual review needed',
    timestamp: '2h ago',
    projectName: 'Legacy Migration',
  },
  {
    id: '7',
    type: 'system',
    title: 'System Update',
    description: 'Pipeline engine updated to v2.4.1 — performance improvements',
    timestamp: '3h ago',
  },
];

function generateThroughputData(points: number, maxCount: number): ThroughputPoint[] {
  const data: ThroughputPoint[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * (24 * 60 * 60 * 1000 / points));
    data.push({
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      count: Math.floor(Math.random() * maxCount) + 2,
    });
  }
  return data;
}

const SECTION_KEYWORDS = [
  'actor', 'actors', 'requirement', 'requirements', 'feature', 'features',
  'use case', 'use cases', 'story', 'stories', 'architecture',
  'api', 'database', 'security', 'overview', 'scope', 'performance',
  'constraint', 'constraints', 'stakeholder', 'stakeholders',
  'dependency', 'dependencies', 'interface', 'interfaces',
  'functional', 'non-functional', 'endpoint', 'endpoints',
  'user', 'users', 'system', 'module', 'modules',
];

function classifyText(text: string): PRDClassification {
  const trimmed = text.trim();
  if (!trimmed) {
    return { category: 'SEED_ONLY', confidence: 0.5, basis: ['Empty input'], wordCount: 0 };
  }

  // Safe word count — cap at first 5000 chars to avoid huge text hangs
  const sample = trimmed.length > 5000 ? trimmed.slice(0, 5000) : trimmed;
  const words = sample.split(/\s+/).filter(Boolean).length;

  // Check for markdown headers (# Header) — safe string check
  const hasHeaders = sample.split('\n').some(line => /^#{1,6}\s+\w/.test(line));

  // Check for section keywords — use simple includes instead of regex
  const lowerSample = sample.toLowerCase();
  const hasSections = SECTION_KEYWORDS.some(kw => lowerSample.includes(kw));

  // Check for numbers
  const hasNumbers = /\d/.test(sample);

  // Avg sentence length — cap sentences checked to 50
  const sentences = sample.split(/[.!?]+/).filter(s => s.trim().length > 0).slice(0, 50);
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((acc, s) => acc + s.trim().split(/\s+/).filter(Boolean).length, 0) / sentences.length
    : 0;

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
    basis.push(avgSentenceLength > 15 ? 'Long-form descriptions' : 'Concise descriptions');
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
  stages: initialStages,
  metrics: {
    activePipelines: 3,
    completedBlueprints: 142,
    avgStageTime: '2m 34s',
    avgStageTimeMs: 154000,
    pipelineHealth: 98.5,
    pipelineHealthDelta: -1.2,
  },
  throughputData24h: generateThroughputData(24, 12),
  throughputData7d: generateThroughputData(14, 20),
  throughputData30d: generateThroughputData(20, 30),
  activityFeed: initialActivityFeed,
  systemStatus: {
    api: true,
    websocket: true,
    database: true,
    queue: true,
    lastSync: '2s ago',
  },
  hasActivePRD: false,
  prdText: '',
  prdClassification: null,

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

  classifyPRD: (text: string) => classifyText(text),

  submitPRD: (text: string) =>
    set(() => ({
      hasActivePRD: true,
      prdText: text,
      prdClassification: classifyText(text),
    })),

  resetPRD: () =>
    set(() => ({
      hasActivePRD: false,
      prdText: '',
      prdClassification: null,
    })),
}));
