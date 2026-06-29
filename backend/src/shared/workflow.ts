// Shared dynamic-workflow types. MUST stay 1:1 with webview/src/shared/workflow.ts
// (see CLAUDE.md). Payload of MessageType.WORKFLOW_PROGRESS (backend → webview).

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'stopped';

/** A declared phase from the workflow script's `meta.phases`. */
export interface WorkflowPhase {
  title: string;
  detail?: string;
}

/**
 * One subagent of a workflow. Stats are computed by the backend from the agent
 * transcript files; `label` is best-effort (derived from the agent's result) as
 * the runtime does not persist the script-supplied label.
 */
export interface WorkflowAgent {
  agentId: string;
  label: string;
  status: 'running' | 'done';
  tokens: number;
  tools: number;
  durationMs: number;
}

/** Aggregate usage, populated from the final `<task-notification>` `<usage>`. */
export interface WorkflowUsage {
  agentCount?: number;
  subagentTokens?: number;
  toolUses?: number;
  durationMs?: number;
}

/** Live + final state of a single background dynamic workflow. */
export interface WorkflowTask {
  /** Workflow tool_use id — the stable key correlating card, panel and events. */
  toolUseId: string;
  /** Background task id (e.g. "w94mspihl") from the immediate tool_result. */
  taskId?: string;
  /** Workflow run id (e.g. "wf_ce882bfa-ddf"), the transcript dir basename. */
  workflowId?: string;
  name: string;
  description?: string;
  /** Absolute path to …/subagents/workflows/wf_<id>. */
  transcriptDir?: string;
  /** Absolute path to the task output file (from the notification). */
  outputFile?: string;
  status: WorkflowStatus;
  startedAt: number;
  endedAt?: number;
  phases: WorkflowPhase[];
  agents: WorkflowAgent[];
  summary?: string;
  /** Workflow return value (raw `<result>` text). */
  result?: string;
  usage?: WorkflowUsage;
}
