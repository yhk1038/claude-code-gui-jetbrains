import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MessageType } from '@/shared';
import { createTestQueryClient } from '@/hooks/queries/__tests__/testQueryClient';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
let connected = true;
let changedHandler: ((message: IPCMessage) => void) | null = null;

const mockSubscribe = vi.fn((type: string, handler: (message: IPCMessage) => void) => {
  if (type === MessageType.CLAUDE_SETTINGS_CHANGED) changedHandler = handler;
  return () => { /* unsubscribe */ };
});

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: connected, send: mockSend, subscribe: mockSubscribe, lastError: null }),
}));

vi.mock('@/contexts/WorkingDirContext', () => ({
  useWorkingDir: () => ({ workingDirectory: '/proj', setWorkingDirectory: vi.fn(), ideRoot: null }),
}));

import { ClaudeSettingsProvider, useClaudeSettings } from '../ClaudeSettingsContext';

function Consumer() {
  const { settings } = useClaudeSettings();
  return <span data-testid="ready">{settings ? 'ready' : 'no'}</span>;
}

function makeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => createTestQueryClient());
    return (
      <QueryClientProvider client={client}>
        <ClaudeSettingsProvider>{children}</ClaudeSettingsProvider>
      </QueryClientProvider>
    );
  };
}

const claudeGets = () => mockSend.mock.calls.filter((c) => c[0] === MessageType.GET_CLAUDE_SETTINGS);
const mergedGets = () => claudeGets().filter((c) => !(c[1] as { scope?: string })?.scope);
const scopeGets = () => claudeGets().filter((c) => (c[1] as { scope?: string })?.scope);

describe('ClaudeSettingsContext', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ status: 'ok', settings: {}, overrides: [] });
    connected = true;
    changedHandler = null;
  });

  it('dedupes GET_CLAUDE_SETTINGS across consumers: merged once + scope once, regardless of consumer count', async () => {
    const Wrapper = makeWrapper();
    render(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(mergedGets().length).toBe(1));
    // Three consumers, yet exactly one merged + one scope request hit the backend.
    expect(mergedGets().length).toBe(1);
    expect(scopeGets().length).toBe(1);
  });

  it('applies a CLAUDE_SETTINGS_CHANGED push without firing another merged GET', async () => {
    const Wrapper = makeWrapper();
    render(<Consumer />, { wrapper: Wrapper });

    await waitFor(() => expect(changedHandler).not.toBeNull());
    await waitFor(() => expect(mergedGets().length).toBe(1));
    const before = mergedGets().length;

    act(() => {
      changedHandler!({ payload: { settings: { theme: 'dark' }, overrides: [] } } as unknown as IPCMessage);
    });

    // Push patches the cache via setQueryData — no extra merged GET is issued.
    expect(mergedGets().length).toBe(before);
  });
});
