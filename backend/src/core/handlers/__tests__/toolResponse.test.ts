import { describe, it, expect, vi, beforeEach } from 'vitest';
import { USER_DECLINED_PREFIX } from '../../../shared';

// Capture what the handler forwards to the CLI process.
const sendControlResponseToProcess = vi.fn();
const sendToolResultToProcess = vi.fn();
vi.mock('../../claude-process', () => ({
  sendControlResponseToProcess: (...args: unknown[]) => sendControlResponseToProcess(...args),
  sendToolResultToProcess: (...args: unknown[]) => sendToolResultToProcess(...args),
}));

import { toolResponseHandler } from '../toolResponse';

function makeConnections() {
  return {
    getClient: () => ({ subscribedSessionId: 'sess-1' }),
    sendTo: vi.fn(),
  } as any;
}

const bridge = {} as any;

beforeEach(() => {
  sendControlResponseToProcess.mockClear();
  sendToolResultToProcess.mockClear();
});

describe('toolResponseHandler — permission denial (control_response path)', () => {
  it('stamps the USER_DECLINED_PREFIX marker on a bare denial', () => {
    toolResponseHandler(
      'conn-1',
      { requestId: 'r1', payload: { toolUseId: 't1', approved: false, controlRequestId: 'ctrl-1' } } as any,
      makeConnections(),
      bridge,
    );

    expect(sendControlResponseToProcess).toHaveBeenCalledTimes(1);
    const [, , response] = sendControlResponseToProcess.mock.calls[0];
    expect(response.response.behavior).toBe('deny');
    expect(response.response.message).toBe(USER_DECLINED_PREFIX);
  });

  it('embeds the user reason after the marker (still detectable as a decline)', () => {
    toolResponseHandler(
      'conn-1',
      {
        requestId: 'r1',
        payload: { toolUseId: 't1', approved: false, controlRequestId: 'ctrl-1', reason: 'use echo instead' },
      } as any,
      makeConnections(),
      bridge,
    );

    const [, , response] = sendControlResponseToProcess.mock.calls[0];
    expect(response.response.message.startsWith(USER_DECLINED_PREFIX)).toBe(true);
    expect(response.response.message).toContain('use echo instead');
  });

  it('approval sends behavior:allow (no marker)', () => {
    toolResponseHandler(
      'conn-1',
      { requestId: 'r1', payload: { toolUseId: 't1', approved: true, controlRequestId: 'ctrl-1' } } as any,
      makeConnections(),
      bridge,
    );

    const [, , response] = sendControlResponseToProcess.mock.calls[0];
    expect(response.response.behavior).toBe('allow');
  });
});

describe('toolResponseHandler — legacy tool_result path (no controlRequestId)', () => {
  it('denial stamps the marker, sets is_error, and ignores payload.result', () => {
    toolResponseHandler(
      'conn-1',
      // no controlRequestId → legacy branch; a stale `result` must not leak through
      { requestId: 'r1', payload: { toolUseId: 't1', approved: false, result: 'Tool execution rejected', reason: 'use ls instead' } } as any,
      makeConnections(),
      bridge,
    );

    expect(sendToolResultToProcess).toHaveBeenCalledTimes(1);
    const [, , toolResult] = sendToolResultToProcess.mock.calls[0];
    expect(toolResult.type).toBe('tool_result');
    expect(toolResult.tool_use_id).toBe('t1');
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content.startsWith(USER_DECLINED_PREFIX)).toBe(true);
    expect(toolResult.content).toContain('use ls instead');
    expect(toolResult.content).not.toBe('Tool execution rejected');
  });

  it('approval forwards the tool result with is_error:false', () => {
    toolResponseHandler(
      'conn-1',
      { requestId: 'r1', payload: { toolUseId: 't1', approved: true, result: 'done' } } as any,
      makeConnections(),
      bridge,
    );

    const [, , toolResult] = sendToolResultToProcess.mock.calls[0];
    expect(toolResult.is_error).toBe(false);
    expect(toolResult.content).toBe('done');
  });
});
