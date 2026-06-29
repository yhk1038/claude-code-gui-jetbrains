import { describe, it, expect, vi } from 'vitest';
import { handleIdeSelectionRequest } from '../ide-selection-route';
import { ConnectionManager } from '../connection-manager';
import { MessageType } from '../../shared';

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as import('ws').WebSocket;
}

describe('handleIdeSelectionRequest', () => {
  it('returns 400 when the body is not valid JSON', () => {
    const cm = new ConnectionManager();
    const result = handleIdeSelectionRequest(cm, 'not json{');
    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error');
  });

  it('returns 400 when absolutePath is missing', () => {
    const cm = new ConnectionManager();
    const result = handleIdeSelectionRequest(
      cm,
      JSON.stringify({ relativePath: 'src/file.ts', workingDir: '/abs' }),
    );
    expect(result.status).toBe(400);
  });

  it('returns 400 when relativePath is missing', () => {
    const cm = new ConnectionManager();
    const result = handleIdeSelectionRequest(
      cm,
      JSON.stringify({ absolutePath: '/abs/src/file.ts', workingDir: '/abs' }),
    );
    expect(result.status).toBe(400);
  });

  it('returns 400 when absolutePath is not a string', () => {
    const cm = new ConnectionManager();
    const result = handleIdeSelectionRequest(
      cm,
      JSON.stringify({ absolutePath: 42, relativePath: 'src/file.ts', workingDir: '/abs' }),
    );
    expect(result.status).toBe(400);
  });

  it('broadcasts IDE_SELECTION with selectedText when there is at least one connection', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      selectedText: 'const x = 1;',
      workingDir: '/abs',
      isGitignored: false,
    });
    const result = handleIdeSelectionRequest(cm, body);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.type).toBe(MessageType.IDE_SELECTION);
    expect(sent.payload).toEqual({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      selectedText: 'const x = 1;',
      workingDir: '/abs',
      isGitignored: false,
    });
  });

  it('broadcasts IDE_SELECTION with isGitignored: true when the file is VCS-ignored', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/dist/bundle.js',
      relativePath: 'dist/bundle.js',
      startLine: null,
      endLine: null,
      selectedText: null,
      workingDir: '/abs',
      isGitignored: true,
    });
    const result = handleIdeSelectionRequest(cm, body);

    expect(result.status).toBe(200);
    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.isGitignored).toBe(true);
  });

  it('normalizes missing isGitignored to false', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    // Kotlin did not send the field (e.g. older plugin version)
    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      selectedText: null,
      workingDir: '/abs',
      // isGitignored intentionally omitted
    });
    handleIdeSelectionRequest(cm, body);

    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.isGitignored).toBe(false);
  });

  it('normalizes non-boolean isGitignored to false', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      selectedText: null,
      workingDir: '/abs',
      isGitignored: 1, // number instead of boolean
    });
    handleIdeSelectionRequest(cm, body);

    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.isGitignored).toBe(false);
  });

  it('broadcasts IDE_SELECTION with null fields when no selection is present', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: null,
      endLine: null,
      selectedText: null,
      workingDir: '/abs',
    });
    const result = handleIdeSelectionRequest(cm, body);

    expect(result.status).toBe(200);
    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.startLine).toBeNull();
    expect(sent.payload.endLine).toBeNull();
    expect(sent.payload.selectedText).toBeNull();
  });

  it('does NOT broadcast and does NOT buffer when there are no connections', () => {
    const cm = new ConnectionManager();
    const broadcastSpy = vi.spyOn(cm, 'broadcastToAll');
    // ide-selection must NOT call setPendingEditorContext either
    const setPendingSpy = vi.spyOn(cm, 'setPendingEditorContext');

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 5,
      endLine: 10,
      selectedText: 'hello',
      workingDir: '/abs',
    });
    const result = handleIdeSelectionRequest(cm, body);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
    expect(broadcastSpy).not.toHaveBeenCalled();
    expect(setPendingSpy).not.toHaveBeenCalled();
  });

  it('normalizes non-number startLine/endLine to null', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 'bad',
      endLine: undefined,
      selectedText: null,
      workingDir: '/abs',
    });
    handleIdeSelectionRequest(cm, body);

    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.startLine).toBeNull();
    expect(sent.payload.endLine).toBeNull();
  });

  it('normalizes non-string selectedText to null', () => {
    const cm = new ConnectionManager();
    const ws = createMockWs();
    cm.addConnection(ws);

    const body = JSON.stringify({
      absolutePath: '/abs/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 1,
      endLine: 2,
      selectedText: 99,
      workingDir: '/abs',
    });
    handleIdeSelectionRequest(cm, body);

    const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent.payload.selectedText).toBeNull();
  });
});
