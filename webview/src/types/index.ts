export type ThemeMode = 'light' | 'dark';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolUses?: ToolUse[];
  context?: Context[];
}

export interface Context {
  type: 'selection' | 'file' | 'explicit';
  path?: string;
  content: string;
  startLine?: number;
  endLine?: number;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface PendingDiff {
  id: string;
  filePath: string;
  diff: string;
  summary: DiffSummary;
  status: 'pending' | 'applied' | 'rejected';
  toolUseId: string;
  oldContent?: string;
  newContent?: string;
  operation?: 'MODIFY' | 'DELETE';
  oldString?: string;
  newString?: string;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  operation: 'create' | 'modify' | 'delete';
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export type SessionState = 'idle' | 'streaming' | 'waiting_permission' | 'has_diff' | 'error';
