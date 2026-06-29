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
  /** Hide finished workflows from the panel (the "Clear" action). The inline
   *  chat cards keep their last status — only the panel list is affected. */
  clearFinished: () => void;
  /** Hide a single workflow from the panel by tool_use id (the per-row "✕").
   *  The inline chat card keeps its status; this only removes it from the
   *  Background tasks list. */
  dismissTask: (toolUseId: string) => void;
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
  // Workflows hidden from the panel via "Clear"/"✕". They stay in taskMap so the
  // inline chat card keeps rendering its real status — dismissing must not make
  // getByToolUseId return undefined (which would fall back to "running").
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusedToolUseId, setFocusedToolUseId] = useState<string | null>(null);

  // currentSessionId is derived from the URL (SSOT) — clear when it changes.
  useEffect(() => {
    setTaskMap(new Map());
    setDismissedIds(new Set());
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
    // Panel lists exclude dismissed workflows; getByToolUseId (inline card) does
    // not — the card must always reflect the workflow's real status.
    const visible = tasks.filter((t) => !dismissedIds.has(t.toolUseId));
    return {
      tasks: visible,
      getByToolUseId: (id) => taskMap.get(id),
      runningTasks: visible.filter((t) => t.status === 'running'),
      finishedTasks: visible.filter((t) => t.status !== 'running'),
      clearFinished: () =>
        setDismissedIds((prev) => {
          const next = new Set(prev);
          for (const t of taskMap.values()) if (t.status !== 'running') next.add(t.toolUseId);
          return next;
        }),
      dismissTask: (id) =>
        setDismissedIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        }),
      panelOpen,
      openPanel,
      closePanel,
      focusedToolUseId,
    };
  }, [taskMap, dismissedIds, panelOpen, openPanel, closePanel, focusedToolUseId]);

  return <WorkflowStateContext.Provider value={value}>{children}</WorkflowStateContext.Provider>;
}

export function useWorkflowState(): WorkflowStateValue {
  const ctx = useContext(WorkflowStateContext);
  if (!ctx) throw new Error('useWorkflowState must be used within a WorkflowStateProvider');
  return ctx;
}
