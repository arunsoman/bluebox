import { useState, useRef, useCallback, useEffect } from 'react';
import type { StreamChunk, LogLine } from '@/types/studio';

let globalChunkId = 0;

const STAGE_MESSAGES: Record<number, { messages: string[]; nodeTypes: string[] }> = {
  0: {
    messages: [
      'Parsing intent from user query...',
      'Detected project type: web application',
      'Confidence: 94% — high confidence match',
      'Extracted goal: build e-commerce platform',
      'Language model: gpt-4 initialized',
      'Intent tokens: 142 processed',
    ],
    nodeTypes: ['IntentParser', 'ConfidenceScorer', 'GoalExtractor', 'Tokenizer'],
  },
  1: {
    messages: [
      'Extracting functional requirements...',
      'Found 12 functional requirements',
      'Non-functional requirement: scalability detected',
      'Priority ranking applied — 3 critical items',
      'Requirement categorization complete',
      'Dependency analysis: 5 requirement chains identified',
    ],
    nodeTypes: ['ReqExtractor', 'CategoryClassifier', 'PriorityRanker', 'DependencyAnalyzer'],
  },
  2: {
    messages: [
      'Scanning for system actors...',
      'Discovered: User, Admin, API Gateway',
      'Ambiguous actor detected: "System" — requires clarification',
      'Actor role mapping in progress...',
      'External system integration: Payment Provider identified',
      'Actor confidence scores: [0.94, 0.87, 0.91, 0.62]',
    ],
    nodeTypes: ['ActorScanner', 'RoleMapper', 'ConfidenceScorer', 'ExternalDetector'],
  },
  3: {
    messages: [
      'Mapping capabilities for User actor...',
      'Capability graph: 8 nodes, 12 edges',
      'Cross-actor capability dependencies found',
      'Capability validation: 7 passed, 1 warning',
      'Writing capability specifications...',
      'Capability confidence: 89% average',
    ],
    nodeTypes: ['CapabilityMapper', 'GraphBuilder', 'Validator', 'SpecWriter'],
  },
  4: {
    messages: [
      'Generating use cases from capabilities...',
      'Use case UC-001: User Registration created',
      'Use case UC-002: Product Search created',
      'Extends relationship detected: UC-003 → UC-002',
      'Use case validation: all preconditions met',
      'Generating use case descriptions...',
    ],
    nodeTypes: ['UseCaseGenerator', 'RelationshipDetector', 'Validator', 'DescWriter'],
  },
  5: {
    messages: [
      'Deriving user stories from use cases...',
      'Story US-001: As a User I want to register...',
      'Story US-002: As a User I want to search...',
      'Acceptance criteria generation...',
      'Story points estimation: 5, 8, 3, 13, 5',
      'Story mapping complete — 24 stories generated',
    ],
    nodeTypes: ['StoryDeriver', 'CriteriaGenerator', 'Estimator', 'StoryMapper'],
  },
  6: {
    messages: [
      'Decomposing stories into tasks...',
      'Task T-001: Create registration form component',
      'Task T-002: Implement email validation service',
      'Task T-003: Set up authentication middleware',
      'Dependency ordering: 3 parallel tracks identified',
      'Task estimation: 2h, 4h, 1h, 3h, 2h',
    ],
    nodeTypes: ['TaskDecomposer', 'DependencyOrderer', 'Estimator', 'TrackPlanner'],
  },
  7: {
    messages: [
      'Assembling ProjectBlueprint artifact...',
      'Schema validation: v2.4.1',
      'Merging all stage outputs...',
      'Blueprint structure: 142 nodes, 89 edges',
      'Final validation: PASS',
      'Exporting blueprint JSON...',
      'Pipeline execution complete!',
    ],
    nodeTypes: ['BlueprintAssembler', 'SchemaValidator', 'Merger', 'Exporter'],
  },
};

const SEVERITIES: Array<'info' | 'success' | 'warning' | 'error' | 'debug'> = [
  'info', 'info', 'info', 'success', 'info', 'warning', 'info', 'debug', 'info', 'success',
];

function generateSampleChunk(stageId: number): StreamChunk {
  globalChunkId++;
  const stageData = STAGE_MESSAGES[stageId] || STAGE_MESSAGES[0];
  const messageIndex = Math.floor(Math.random() * stageData.messages.length);
  const nodeTypeIndex = Math.floor(Math.random() * stageData.nodeTypes.length);

  return {
    id: `chunk-${globalChunkId}`,
    chunk_id: globalChunkId,
    node_type: stageData.nodeTypes[nodeTypeIndex],
    node_data: {
      stage: stageId,
      timestamp: Date.now(),
      confidence: Math.random() * 0.3 + 0.65,
      tokens: Math.floor(Math.random() * 500) + 50,
      model: 'gpt-4',
      latency_ms: Math.floor(Math.random() * 200) + 30,
    },
    stage_id: stageId,
    timestamp: new Date().toISOString(),
    severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
    message: stageData.messages[messageIndex],
  };
}

function chunkToLogLine(chunk: StreamChunk): LogLine {
  const date = new Date(chunk.timestamp);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    id: chunk.id,
    timestamp: timeStr,
    stageId: chunk.stage_id,
    severity: chunk.severity,
    message: chunk.message,
    isSteeringOpportunity: chunk.severity === 'warning',
  };
}

interface StreamingSimulatorState {
  logs: LogLine[];
  chunks: StreamChunk[];
  isRunning: boolean;
  isPaused: boolean;
  currentStage: number;
  progress: number;
}

interface StreamingSimulatorActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  clear: () => void;
}

export function useStreamingSimulator(): StreamingSimulatorState & StreamingSimulatorActions {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageProgressRef = useRef(0);
  const currentStageRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  const generateChunk = useCallback(() => {
    const stage = currentStageRef.current;
    const chunk = generateSampleChunk(stage);
    const logLine = chunkToLogLine(chunk);

    setChunks((prev) => [...prev.slice(-199), chunk]);
    setLogs((prev) => [...prev.slice(-199), logLine]);

    // Advance stage progress
    stageProgressRef.current += Math.random() * 15 + 5;
    if (stageProgressRef.current >= 100) {
      stageProgressRef.current = 0;
      if (currentStageRef.current < 7) {
        currentStageRef.current += 1;
        setCurrentStage(currentStageRef.current);
      }
    }

    // Update overall progress (0-100 across 8 stages)
    const overallProgress = Math.min(
      100,
      ((currentStageRef.current * 100 + stageProgressRef.current) / 8)
    );
    setProgress(Math.round(overallProgress));

    // Auto-stop when complete
    if (currentStageRef.current >= 7 && stageProgressRef.current >= 90) {
      setIsRunning(false);
      setIsPaused(false);
    }
  }, []);

  const start = useCallback(() => {
    // Reset and start fresh
    globalChunkId = 0;
    setLogs([]);
    setChunks([]);
    setCurrentStage(0);
    setProgress(0);
    stageProgressRef.current = 0;
    currentStageRef.current = 0;
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
    setChunks([]);
    globalChunkId = 0;
  }, []);

  // Interval effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        generateChunk();
      }, 1200);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, generateChunk]);

  return {
    logs,
    chunks,
    isRunning,
    isPaused,
    currentStage,
    progress,
    start,
    pause,
    resume,
    stop,
    clear,
  };
}
