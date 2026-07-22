import { describe, it, expect, vi } from 'vitest';
import { handleEditorContextRequest } from '../editor-context-route';
import { ConnectionManager } from '../connection-manager';
import { ClientEnv, MessageType } from '../../shared';

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as import('ws').WebSocket;
}

describe('handleEditorContextRequest', () => {
  it('returns 400 when the body is not valid JSON', () => {
    const cm = new ConnectionManager();
    const result = handleEditorContextRequest(cm, 'not json{');
    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error');
  });

  it('returns 400 when absolutePath is missing', () => {
    const cm = new ConnectionManager();
    const result = handleEditorContextRequest(
      cm,
      JSON.stringify({ relativePath: 'src/file.ts' }),
    );
    expect(result.status).toBe(400);
  });

  it('returns 400 when relativePath is missing', () => {
    const cm = new ConnectionManager();
    const result = handleEditorContextRequest(
      cm,
      JSON.stringify({ absolutePath: '/abs/src/file.ts' }),
    );
    expect(result.status).toBe(400);
  });

  it('returns 400 when absolutePath is not a string', () => {
    const cm = new ConnectionManager();
    const result = handleEditorContextRequest(
      cm,
      JSON.stringify({ absolutePath: 42, relativePath: 'src/file.ts' }),
    );
    expect(result.status).toBe(400);
  });

  it('broadcasts EDITOR_CONTEXT when there is at least one connection', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      workingDir: '/abs',
    });
    const result = handleEditorContextRequest(cm, body);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, revealTarget: { kind: 'none' } });
    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.type).toBe(MessageType.EDITOR_CONTEXT);
    expect(sent.payload).toEqual({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      workingDir: '/abs',
    });
  });

  it('reports the focused JCEF panel as the reveal target', () => {
    const cm = new ConnectionManager();
    cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
    cm.setLastFocusedPanelId('panel-1');

    const result = handleEditorContextRequest(
      cm,
      JSON.stringify({ absolutePath: '/abs/f.ts', relativePath: 'f.ts' }),
    );

    expect(result.body).toEqual({
      success: true,
      revealTarget: { kind: 'jcef', panelId: 'panel-1' },
    });
  });

  it('stashes the payload as pending when there are no connections', () => {
    const cm = new ConnectionManager();
    const setPending = vi.spyOn(cm, 'setPendingEditorContext');

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      workingDir: '/abs',
    });
    const result = handleEditorContextRequest(cm, body);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, revealTarget: { kind: 'none' } });
    expect(setPending).toHaveBeenCalledTimes(1);
    expect(setPending).toHaveBeenCalledWith({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      workingDir: '/abs',
    });
  });

  it('routes EDITOR_CONTEXT only to the last-focused panel when it is live', () => {
    const cm = new ConnectionManager();
    const wsFocused = createMockWs();
    cm.addConnection(wsFocused, ClientEnv.BROWSER, 'panel-1');
    const wsOther = createMockWs();
    cm.addConnection(wsOther, ClientEnv.BROWSER, 'panel-2');
    cm.setLastFocusedPanelId('panel-1');

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      workingDir: '/abs',
    });
    const result = handleEditorContextRequest(cm, body);

    expect(result.status).toBe(200);
    expect(wsFocused.send).toHaveBeenCalledTimes(1);
    expect(wsOther.send).not.toHaveBeenCalled();
    const sent = JSON.parse((wsFocused.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.type).toBe(MessageType.EDITOR_CONTEXT);
    expect(sent.payload.absolutePath).toBe('/abs/src/file.ts');
  });

  it('falls back to broadcasting EDITOR_CONTEXT when the focused panel is not live', () => {
    const cm = new ConnectionManager();
    const ws1 = createMockWs();
    cm.addConnection(ws1, ClientEnv.BROWSER, 'panel-1');
    const ws2 = createMockWs();
    cm.addConnection(ws2, ClientEnv.BROWSER, 'panel-2');
    // Focus points at a panel with no live connection → safe fallback.
    cm.setLastFocusedPanelId('ghost-panel');

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      workingDir: '/abs',
    });
    handleEditorContextRequest(cm, body);

    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).toHaveBeenCalledTimes(1);
  });

  it('preserves null startLine/endLine when no selection is present', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      workingDir: '/abs',
    });
    handleEditorContextRequest(cm, body);

    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.startLine).toBeNull();
    expect(sent.payload.endLine).toBeNull();
  });
});
