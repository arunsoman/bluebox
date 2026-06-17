export interface StreamChunk {
  id: string;
  chunk_id: number;
  node_type: string;
  node_data: Record<string, unknown>;
  stage_id: number;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error' | 'debug';
  message: string;
}

export interface LogLine {
  id: string;
  timestamp: string;
  stageId: number;
  severity: 'info' | 'success' | 'warning' | 'error' | 'debug';
  message: string;
  isSteeringOpportunity?: boolean;
}

export type SteeringMode = 'context' | 'input' | 'review' | 'collapsed';
export type PipelineRunState = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

export interface SteeringRequest {
  id: string;
  stageId: number;
  stageName: string;
  description: string;
  confidence: number;
  contextLines: string[];
  suggestions: string[];
}

export interface StageOutput {
  stageId: number;
  stageName: string;
  duration: string;
  summary: string;
  outputs: { type: string; count: number }[];
}
