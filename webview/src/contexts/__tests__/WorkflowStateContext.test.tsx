import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { WorkflowStateProvider, useWorkflowState } from '../WorkflowStateContext';
import type { WorkflowTask } from '@/shared';

// Capture the WORKFLOW_PROGRESS subscriber so tests can push backend updates.
let capturedHandler: ((msg: { payload: unknown }) => void) | null = null;
const mockSubscribe = vi.fn((_type: string, cb: (msg: { payload: unknown }) => void) => {
  capturedHandler = cb;
  return vi.fn();
});

vi.mock('../BridgeContext', () => ({
  useBridgeContext: () => ({ subscribe: mockSubscribe, isConnected: true }),
}));

let mockSessionId: string | null = 's1';
vi.mock('../SessionContext', () => ({
  useSessionContext: () => ({ currentSessionId: mockSessionId }),
}));

let ctx: ReturnType<typeof useWorkflowState>;
function Harness() {
  ctx = useWorkflowState();
  return null;
}

function emit(task: Partial<WorkflowTask> & Pick<WorkflowTask, 'toolUseId'>) {
  act(() => {
    capturedHandler?.({
      payload: { name: 'wf', status: 'running', startedAt: 0, phases: [], agents: [], ...task },
    });
  });
}

beforeEach(() => {
  capturedHandler = null;
  mockSessionId = 's1';
  render(
    <WorkflowStateProvider>
      <Harness />
    </WorkflowStateProvider>,
  );
});

describe('WorkflowStateContext', () => {
  it('ingests WORKFLOW_PROGRESS into the task list keyed by toolUseId', () => {
    emit({ toolUseId: 't1' });
    expect(ctx.tasks).toHaveLength(1);
    // A later update for the same id replaces (not duplicates) the task.
    emit({ toolUseId: 't1', status: 'completed' });
    expect(ctx.tasks).toHaveLength(1);
    expect(ctx.finishedTasks).toHaveLength(1);
    expect(ctx.runningTasks).toHaveLength(0);
  });

  it('dismissTask drops a single workflow — including one stuck on running', () => {
    emit({ toolUseId: 't1', status: 'running' });
    emit({ toolUseId: 't2', status: 'completed' });
    expect(ctx.tasks).toHaveLength(2);

    act(() => ctx.dismissTask('t1'));
    expect(ctx.tasks.map((t) => t.toolUseId)).toEqual(['t2']);
  });

  it('clearFinished keeps running workflows and removes finished ones', () => {
    emit({ toolUseId: 't1', status: 'running' });
    emit({ toolUseId: 't2', status: 'completed' });
    emit({ toolUseId: 't3', status: 'stopped' });

    act(() => ctx.clearFinished());
    expect(ctx.tasks.map((t) => t.toolUseId)).toEqual(['t1']);
  });
});
