import { describe, expect, it, vi } from 'vitest';
import { JetBrainsBridge } from '../../bridge/jetbrains-bridge';

type MessageHandler = (data: Buffer) => void;

function createRpcClient(respond: (request: Record<string, unknown>) => Record<string, unknown>) {
  let messageHandler: MessageHandler | null = null;

  return {
    readyState: 1,
    on: vi.fn((event: string, handler: MessageHandler) => {
      if (event === 'message') {
        messageHandler = handler;
      }
    }),
    send: vi.fn((data: string) => {
      if (!messageHandler) return;
      const request = JSON.parse(data.trim()) as Record<string, unknown>;
      messageHandler(Buffer.from(JSON.stringify(respond(request))));
    }),
  } as any;
}

describe('JetBrainsBridge RPC routing', () => {
  it('retries routed workingDir requests on the next RPC client when one IDE does not own the project', async () => {
    const bridge = new JetBrainsBridge();
    const wrongProjectClient = createRpcClient((request) => ({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32000, message: 'No handler for openNewTab: C:/project-a' },
    }));
    const rightProjectClient = createRpcClient((request) => ({
      jsonrpc: '2.0',
      id: request.id,
      result: {},
    }));

    bridge.addRpcClient(wrongProjectClient);
    bridge.addRpcClient(rightProjectClient);

    await bridge.openNewTab('C:/project-a');

    expect(wrongProjectClient.send).toHaveBeenCalledTimes(1);
    expect(rightProjectClient.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(rightProjectClient.send.mock.calls[0][0].trim())).toMatchObject({
      method: 'OPEN_NEW_TAB',
      params: { workingDir: 'C:/project-a' },
    });
  });
});
