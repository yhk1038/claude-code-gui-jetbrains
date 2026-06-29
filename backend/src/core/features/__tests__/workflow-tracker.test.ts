import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { reconstructWorkflowTasks, WorkflowProgressTracker } from '../workflow-tracker';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { WorkflowTask } from '../../../shared';

let dir: string;
let transcriptDir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wf-test-'));
  transcriptDir = join(dir, 'subagents', 'workflows', 'wf_abc123-def');
  mkdirSync(transcriptDir, { recursive: true });

  // journal: agent a1 done (with topic), agent a2 still running
  const journal = [
    JSON.stringify({ type: 'started', key: 'k1', agentId: 'a1' }),
    JSON.stringify({ type: 'started', key: 'k2', agentId: 'a2' }),
    JSON.stringify({ type: 'result', key: 'k1', agentId: 'a1', result: { topic: 'океан', fact: '…' } }),
  ].join('\n');
  writeFileSync(join(transcriptDir, 'journal.jsonl'), journal);

  // agent a1 transcript: one assistant turn with usage + a tool_use, spanning 7s.
  // cache_read dominates real subagent turns (context reuse), so it must be counted.
  const a1 = [
    JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: { role: 'user', content: 'go' } }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-01-01T00:00:07.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }],
        usage: { input_tokens: 15781, cache_creation_input_tokens: 18515, cache_read_input_tokens: 50000, output_tokens: 244 },
      },
    }),
  ].join('\n');
  writeFileSync(join(transcriptDir, 'agent-a1.jsonl'), a1);

  // agent a2 transcript: running, no usage yet
  writeFileSync(
    join(transcriptDir, 'agent-a2.jsonl'),
    JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'user', content: 'go' } }),
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function messages() {
  const launched =
    `Workflow launched in background. Task ID: w1\n` +
    `Summary: demo\n` +
    `Transcript dir: ${transcriptDir}\n` +
    `Script file: ${transcriptDir}/script.js`;
  const notif = [
    '<task-notification>',
    '<task-id>w1</task-id>',
    '<tool-use-id>toolu_1</tool-use-id>',
    `<output-file>${dir}/tasks/w1.output</output-file>`,
    '<status>completed</status>',
    '<summary>Dynamic workflow "demo" completed</summary>',
    '<result>{"ok":true}</result>',
    '<usage><agent_count>2</agent_count><subagent_tokens>68760</subagent_tokens><tool_uses>1</tool_uses><duration_ms>7000</duration_ms></usage>',
    '</task-notification>',
  ].join('\n');

  return [
    {
      type: 'assistant',
      timestamp: '2026-01-01T00:00:00.000Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Workflow',
            input: { description: 'demo', script: "export const meta = { name: 'demo-flow', phases: [{ title: 'Phase 1' }] }" },
          },
        ],
      },
    },
    {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: launched }] },
    },
    { type: 'user', message: { role: 'user', content: notif } },
  ] as Array<Record<string, unknown>>;
}

describe('reconstructWorkflowTasks', () => {
  it('rebuilds a finished workflow with agents, phases, status and usage', async () => {
    const tasks = await reconstructWorkflowTasks(messages());
    expect(tasks).toHaveLength(1);
    const t = tasks[0];

    expect(t.toolUseId).toBe('toolu_1');
    expect(t.name).toBe('demo-flow');
    expect(t.taskId).toBe('w1');
    expect(t.workflowId).toBe('wf_abc123-def');
    expect(t.transcriptDir).toBe(transcriptDir);
    expect(t.status).toBe('completed');
    expect(t.summary).toContain('completed');
    expect(t.result).toBe('{"ok":true}');
    expect(t.phases).toEqual([{ title: 'Phase 1' }]);
    expect(t.usage).toMatchObject({ agentCount: 2, subagentTokens: 68760, toolUses: 1, durationMs: 7000 });

    // agents aggregated from transcript files
    expect(t.agents).toHaveLength(2);
    const a1 = t.agents.find((a) => a.agentId === 'a1')!;
    expect(a1.status).toBe('done');
    expect(a1.label).toBe('океан'); // derived from journal result.topic
    expect(a1.tokens).toBe(15781 + 18515 + 50000 + 244); // input + cache_creation + cache_read + output
    expect(a1.tools).toBe(1);
    expect(a1.durationMs).toBe(7000);

    // a2 has no journal result, but the workflow is completed (terminal), so it
    // is settled to done — a finished card must not show pulsing running dots.
    const a2 = t.agents.find((a) => a.agentId === 'a2')!;
    expect(a2.status).toBe('done');
  });

  it('returns [] when there is no Workflow tool_use', async () => {
    const tasks = await reconstructWorkflowTasks([
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } },
    ]);
    expect(tasks).toEqual([]);
  });

  // A workflow whose transcript has no terminal <task-notification> (interrupted,
  // or its final event was lost). Without the live check it would be resurrected
  // as 'running' on every reload — the bug this guards against.
  function messagesWithoutNotification() {
    const launched = `Workflow launched in background. Task ID: w1\nTranscript dir: ${transcriptDir}`;
    return [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_x', name: 'Workflow', input: { description: 'demo' } }],
        },
      },
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: launched }] },
      },
    ] as Array<Record<string, unknown>>;
  }

  it('settles a notification-less workflow to stopped when it is not live', async () => {
    const tasks = await reconstructWorkflowTasks(messagesWithoutNotification(), () => false);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('stopped');
    // No agent stays running, but an interrupted one (a2, no journal result)
    // goes grey 'stopped' — never green 'done'. a1 finished, so it stays done.
    expect(tasks[0].agents.some((a) => a.status === 'running')).toBe(false);
    expect(tasks[0].agents.find((a) => a.agentId === 'a1')!.status).toBe('done');
    expect(tasks[0].agents.find((a) => a.agentId === 'a2')!.status).toBe('stopped');
  });

  it('keeps a live workflow\'s unfinished agents running', async () => {
    const tasks = await reconstructWorkflowTasks(messagesWithoutNotification(), () => true);
    expect(tasks[0].status).toBe('running');
    expect(tasks[0].agents.some((a) => a.status === 'running')).toBe(true);
  });

  it('keeps a notification-less workflow running when it is still live', async () => {
    const tasks = await reconstructWorkflowTasks(messagesWithoutNotification(), (id) => id === 'toolu_x');
    expect(tasks[0].status).toBe('running');
  });

  it('defaults a notification-less workflow to stopped when no live check is given', async () => {
    const tasks = await reconstructWorkflowTasks(messagesWithoutNotification());
    expect(tasks[0].status).toBe('stopped');
  });
});

describe('WorkflowProgressTracker stop handling', () => {
  /** Capture WORKFLOW_PROGRESS broadcasts into a flat list. */
  function makeTracker() {
    const broadcasts: WorkflowTask[] = [];
    const connections = {
      broadcastToSession: (_sessionId: string, _type: string, payload: Record<string, unknown>) => {
        broadcasts.push(JSON.parse(JSON.stringify(payload)) as WorkflowTask);
      },
    } as unknown as ConnectionManager;
    const tracker = WorkflowProgressTracker.create(connections);
    return { tracker, broadcasts, last: () => broadcasts[broadcasts.length - 1] };
  }

  const startedEvent = {
    type: 'system',
    subtype: 'task_started',
    tool_use_id: 'toolu_1',
    task_id: 'w1',
    workflow_name: 'demo-flow',
  };

  it('settles a running workflow as stopped on interrupt (stopRunning) and broadcasts it', () => {
    const { tracker, last } = makeTracker();
    tracker.handleEvent('s1', startedEvent);
    expect(last().status).toBe('running');

    tracker.stopRunning('s1');
    const t = last();
    expect(t.status).toBe('stopped');
    expect(t.endedAt).toBeGreaterThan(0);
    expect(t.usage?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not overwrite a completed workflow when stopped afterwards', () => {
    const { tracker, last } = makeTracker();
    tracker.handleEvent('s1', startedEvent);
    tracker.handleEvent('s1', {
      type: 'system',
      subtype: 'task_notification',
      tool_use_id: 'toolu_1',
      status: 'completed',
    });
    expect(last().status).toBe('completed');

    tracker.stopRunning('s1');
    expect(last().status).toBe('completed');
  });

  it('only touches workflows of the targeted session', () => {
    const { tracker, broadcasts } = makeTracker();
    tracker.handleEvent('s1', startedEvent);
    tracker.handleEvent('s2', { ...startedEvent, tool_use_id: 'toolu_2' });

    tracker.stopRunning('s1');
    const s2 = broadcasts.filter((b) => b.toolUseId === 'toolu_2');
    expect(s2.every((b) => b.status === 'running')).toBe(true);
  });

  it('settles still-running workflows on process close (stopSession)', () => {
    const { tracker, last } = makeTracker();
    tracker.handleEvent('s1', startedEvent);
    tracker.stopSession('s1');
    expect(last().status).toBe('stopped');
  });

  it('isRunning reflects live state and flips off once stopped', () => {
    const { tracker } = makeTracker();
    expect(tracker.isRunning('s1', 'toolu_1')).toBe(false); // unknown
    tracker.handleEvent('s1', startedEvent);
    expect(tracker.isRunning('s1', 'toolu_1')).toBe(true);
    expect(tracker.isRunning('s2', 'toolu_1')).toBe(false); // wrong session
    tracker.stopRunning('s1');
    expect(tracker.isRunning('s1', 'toolu_1')).toBe(false);
  });
});
