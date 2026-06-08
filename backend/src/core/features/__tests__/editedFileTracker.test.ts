import { describe, it, expect } from 'vitest';
import {
  extractEditTargets,
  extractSucceededToolUseIds,
  EditedFileTracker,
} from '../editedFileTracker';

/**
 * Builds a Claude CLI stream-json `assistant` event carrying tool_use blocks.
 */
function assistantEvent(blocks: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: blocks },
    session_id: 'sess-1',
  };
}

/**
 * Builds a Claude CLI stream-json `user` event carrying tool_result blocks.
 */
function userEvent(blocks: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    type: 'user',
    message: { role: 'user', content: blocks },
    session_id: 'sess-1',
  };
}

describe('extractEditTargets', () => {
  it('extracts file_path from an Edit tool_use', () => {
    const event = assistantEvent([
      { type: 'tool_use', id: 'tu-1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
    ]);
    expect(extractEditTargets(event)).toEqual([{ toolUseId: 'tu-1', filePath: '/repo/a.ts' }]);
  });

  it('extracts file_path from Write and MultiEdit tools', () => {
    const event = assistantEvent([
      { type: 'tool_use', id: 'tu-w', name: 'Write', input: { file_path: '/repo/new.ts', content: 'hi' } },
      { type: 'tool_use', id: 'tu-m', name: 'MultiEdit', input: { file_path: '/repo/multi.ts', edits: [] } },
    ]);
    expect(extractEditTargets(event)).toEqual([
      { toolUseId: 'tu-w', filePath: '/repo/new.ts' },
      { toolUseId: 'tu-m', filePath: '/repo/multi.ts' },
    ]);
  });

  it('extracts notebook_path from a NotebookEdit tool', () => {
    const event = assistantEvent([
      { type: 'tool_use', id: 'tu-nb', name: 'NotebookEdit', input: { notebook_path: '/repo/nb.ipynb', new_source: 'print(1)' } },
    ]);
    expect(extractEditTargets(event)).toEqual([{ toolUseId: 'tu-nb', filePath: '/repo/nb.ipynb' }]);
  });

  it('ignores non-editing tools like Read and Bash', () => {
    const event = assistantEvent([
      { type: 'tool_use', id: 'tu-r', name: 'Read', input: { file_path: '/repo/a.ts' } },
      { type: 'tool_use', id: 'tu-b', name: 'Bash', input: { command: 'ls' } },
    ]);
    expect(extractEditTargets(event)).toEqual([]);
  });

  it('ignores text blocks and tool_use without a path', () => {
    const event = assistantEvent([
      { type: 'text', text: 'editing now' },
      { type: 'tool_use', id: 'tu-x', name: 'Edit', input: {} },
    ]);
    expect(extractEditTargets(event)).toEqual([]);
  });

  it('returns empty for non-assistant events', () => {
    expect(extractEditTargets(userEvent([]))).toEqual([]);
    expect(extractEditTargets({ type: 'result' })).toEqual([]);
    expect(extractEditTargets({})).toEqual([]);
  });
});

describe('extractSucceededToolUseIds', () => {
  it('returns tool_use_ids of successful tool_result blocks', () => {
    const event = userEvent([
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'ok', is_error: false },
    ]);
    expect(extractSucceededToolUseIds(event)).toEqual(['tu-1']);
  });

  it('treats a missing is_error as success', () => {
    const event = userEvent([
      { type: 'tool_result', tool_use_id: 'tu-2', content: 'ok' },
    ]);
    expect(extractSucceededToolUseIds(event)).toEqual(['tu-2']);
  });

  it('excludes errored tool_result blocks', () => {
    const event = userEvent([
      { type: 'tool_result', tool_use_id: 'tu-err', content: 'boom', is_error: true },
      { type: 'tool_result', tool_use_id: 'tu-ok', content: 'ok', is_error: false },
    ]);
    expect(extractSucceededToolUseIds(event)).toEqual(['tu-ok']);
  });

  it('returns empty for non-user events', () => {
    expect(extractSucceededToolUseIds(assistantEvent([]))).toEqual([]);
    expect(extractSucceededToolUseIds({})).toEqual([]);
  });
});

describe('EditedFileTracker', () => {
  it('returns a path only after the matching tool_result succeeds', () => {
    const tracker = new EditedFileTracker();

    // assistant announces the edit — file not written yet (default/ask mode)
    tracker.recordEdits(
      assistantEvent([
        { type: 'tool_use', id: 'tu-1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
      ]),
    );
    // no refresh until the tool actually completes
    expect(tracker.collectRefreshPaths(assistantEvent([]))).toEqual([]);

    // tool_result arrives → the file is now on disk
    const paths = tracker.collectRefreshPaths(
      userEvent([{ type: 'tool_result', tool_use_id: 'tu-1', content: 'ok', is_error: false }]),
    );
    expect(paths).toEqual(['/repo/a.ts']);
  });

  it('does not refresh when the edit failed', () => {
    const tracker = new EditedFileTracker();
    tracker.recordEdits(
      assistantEvent([
        { type: 'tool_use', id: 'tu-1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
      ]),
    );
    const paths = tracker.collectRefreshPaths(
      userEvent([{ type: 'tool_result', tool_use_id: 'tu-1', content: 'boom', is_error: true }]),
    );
    expect(paths).toEqual([]);
  });

  it('does not yield the same tool_use twice', () => {
    const tracker = new EditedFileTracker();
    tracker.recordEdits(
      assistantEvent([
        { type: 'tool_use', id: 'tu-1', name: 'Write', input: { file_path: '/repo/a.ts', content: 'hi' } },
      ]),
    );
    const result = userEvent([{ type: 'tool_result', tool_use_id: 'tu-1', content: 'ok', is_error: false }]);
    expect(tracker.collectRefreshPaths(result)).toEqual(['/repo/a.ts']);
    // a duplicated result event must not re-emit the path
    expect(tracker.collectRefreshPaths(result)).toEqual([]);
  });

  it('deduplicates repeated paths within one result event', () => {
    const tracker = new EditedFileTracker();
    tracker.recordEdits(
      assistantEvent([
        { type: 'tool_use', id: 'tu-1', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' } },
        { type: 'tool_use', id: 'tu-2', name: 'Edit', input: { file_path: '/repo/a.ts', old_string: 'y', new_string: 'z' } },
      ]),
    );
    const paths = tracker.collectRefreshPaths(
      userEvent([
        { type: 'tool_result', tool_use_id: 'tu-1', content: 'ok', is_error: false },
        { type: 'tool_result', tool_use_id: 'tu-2', content: 'ok', is_error: false },
      ]),
    );
    expect(paths).toEqual(['/repo/a.ts']);
  });

  it('ignores tool_results for unknown tool_use ids', () => {
    const tracker = new EditedFileTracker();
    const paths = tracker.collectRefreshPaths(
      userEvent([{ type: 'tool_result', tool_use_id: 'never-seen', content: 'ok', is_error: false }]),
    );
    expect(paths).toEqual([]);
  });
});
