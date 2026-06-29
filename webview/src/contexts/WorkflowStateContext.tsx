import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useBridgeContext } from './BridgeContext';
import { useSessionContext } from './SessionContext';
import { MessageType } from '@/shared';
import type { WorkflowTask } from '@/shared';

interface WorkflowStateValue {
  /** All known workflows for the current session (running + finished). */
  tasks: WorkflowTask[];
  getByToolUseId: (toolUseId: string) => WorkflowTask | undefined;
  runningTasks: WorkflowTask[];
  finishedTasks: WorkflowTask[];
  /** Drop finished workflows (the panel's "Clear" action). */
  clearFinished: () => void;
  // Background tasks panel UI state
  panelOpen: boolean;
  /** Open the panel; pass a toolUseId to scroll/highlight that workflow. */
  openPanel: (toolUseId?: string) => void;
  closePanel: () => void;
  focusedToolUseId: string | null;
}

const WorkflowStateContext = createContext<WorkflowStateValue | null>(null);

/**
 * Holds live dynamic-workflow progress streamed from the backend via
 * WORKFLOW_PROGRESS. Keyed by the Workflow tool_use id so the inline card and
 * the Background tasks panel read the same source. Resets on session change.
 */
export function WorkflowStateProvider({ children }: { children: ReactNode }) {
  const { subscribe, isConnected } = useBridgeContext();
  const { currentSessionId } = useSessionContext();
  const [taskMap, setTaskMap] = useState<Map<string, WorkflowTask>>(new Map());
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusedToolUseId, setFocusedToolUseId] = useState<string | null>(null);

  // currentSessionId is derived from the URL (SSOT) — clear when it changes.
  useEffect(() => {
    setTaskMap(new Map());
    setPanelOpen(false);
    setFocusedToolUseId(null);
  }, [currentSessionId]);

  const openPanel = useCallback((toolUseId?: string) => {
    setFocusedToolUseId(toolUseId ?? null);
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  useEffect(() => {
    if (!isConnected) return;
    return subscribe(MessageType.WORKFLOW_PROGRESS, (message) => {
      const task = message.payload as unknown as WorkflowTask;
      if (!task?.toolUseId) return;
      setTaskMap((prev) => {
        const next = new Map(prev);
        next.set(task.toolUseId, task);
        return next;
      });
    });
  }, [isConnected, subscribe]);

  const value = useMemo<WorkflowStateValue>(() => {
    const tasks = Array.from(taskMap.values());
    return {
      tasks,
      getByToolUseId: (id) => taskMap.get(id),
      runningTasks: tasks.filter((t) => t.status === 'running'),
      finishedTasks: tasks.filter((t) => t.status !== 'running'),
      clearFinished: () =>
        setTaskMap((prev) => {
          const next = new Map<string, WorkflowTask>();
          for (const [k, v] of prev) if (v.status === 'running') next.set(k, v);
          return next;
        }),
      panelOpen,
      openPanel,
      closePanel,
      focusedToolUseId,
    };
  }, [taskMap, panelOpen, openPanel, closePanel, focusedToolUseId]);

  return <WorkflowStateContext.Provider value={value}>{children}</WorkflowStateContext.Provider>;
}

export function useWorkflowState(): WorkflowStateValue {
  const ctx = useContext(WorkflowStateContext);
  if (!ctx) throw new Error('useWorkflowState must be used within a WorkflowStateProvider');
  return ctx;
}
