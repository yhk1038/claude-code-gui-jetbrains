import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePendingPermissions } from '../usePendingPermissions';

// ---------------------------------------------------------------------------
// Mock bridge
// ---------------------------------------------------------------------------

type BridgeHandler = (msg: { type: string; payload: unknown }) => void;

function createMockBridge() {
  const handlers = new Map<string, Set<BridgeHandler>>();

  const bridge = {
    isConnected: true,
    send: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((type: string, handler: BridgeHandler) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => {
        handlers.get(type)?.delete(handler);
      };
    }),
    request: vi.fn().mockResolvedValue(undefined),
  };

  const emit = (type: string, payload: unknown) => {
    const msg = { type, payload };
    handlers.get(type)?.forEach(h => h(msg));
  };

  return { bridge, emit };
}

// ---------------------------------------------------------------------------
// Mocks for context hooks and BridgeClient singleton
// ---------------------------------------------------------------------------

const mockDeny = vi.fn().mockResolvedValue(undefined);
const mockApprove = vi.fn().mockResolvedValue(undefined);

const mockApi = {
  tools: {
    deny: mockDeny,
    approve: mockApprove,
  },
};

vi.mock('@/contexts/ApiContext', () => ({
  useApi: () => mockApi,
}));

vi.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ currentSessionId: 'session-1' }),
}));

let mockBridge: ReturnType<typeof createMockBridge>['bridge'];
let mockEmit: ReturnType<typeof createMockBridge>['emit'];

vi.mock('@/api/bridge/BridgeClient', () => ({
  getBridgeClient: () => mockBridge,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emit a CLI_EVENT control_request for a Bash tool. */
function emitBashRequest(
  emit: typeof mockEmit,
  opts: { controlRequestId?: string; toolUseId?: string; command?: string } = {},
) {
  const {
    controlRequestId = 'ctrl-1',
    toolUseId = 'tool-1',
    command = 'ls -la',
  } = opts;

  emit('CLI_EVENT', {
    type: 'control_request',
    request_id: controlRequestId,
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      tool_use_id: toolUseId,
      input: { command },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePendingPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockBridge();
    mockBridge = mock.bridge;
    mockEmit = mock.emit;
  });

  describe('deny with reason', () => {
    it('passes reason to api.tools.deny when deny is called with a reason', () => {
      const { result } = renderHook(() => usePendingPermissions());

      // Inject a pending request via bridge
      act(() => {
        emitBashRequest(mockEmit, {
          controlRequestId: 'ctrl-1',
          toolUseId: 'tool-1',
        });
      });

      expect(result.current.pending).not.toBeNull();

      act(() => {
        result.current.deny('ctrl-1', 'Please use echo instead');
      });

      expect(mockDeny).toHaveBeenCalledTimes(1);
      expect(mockDeny).toHaveBeenCalledWith(
        'tool-1',
        'ctrl-1',
        'Please use echo instead',
      );
    });

    it('passes reason correctly when reason contains special characters', () => {
      const { result } = renderHook(() => usePendingPermissions());

      act(() => {
        emitBashRequest(mockEmit, {
          controlRequestId: 'ctrl-2',
          toolUseId: 'tool-2',
        });
      });

      const specialReason = 'Use `git diff` instead of rm -rf /';

      act(() => {
        result.current.deny('ctrl-2', specialReason);
      });

      expect(mockDeny).toHaveBeenCalledWith('tool-2', 'ctrl-2', specialReason);
    });

    it('forwards a multiline reason to api.tools.deny', () => {
      const { result } = renderHook(() => usePendingPermissions());

      act(() => {
        emitBashRequest(mockEmit, {
          controlRequestId: 'ctrl-3',
          toolUseId: 'tool-3',
        });
      });

      const multilineReason = 'line1\nline2\nline3';

      act(() => {
        result.current.deny('ctrl-3', multilineReason);
      });

      expect(mockDeny).toHaveBeenCalledWith('tool-3', 'ctrl-3', multilineReason);
    });
  });

  describe('deny without reason (existing behavior preserved)', () => {
    it('calls api.tools.deny without passing a truthy reason when no reason is provided', () => {
      const { result } = renderHook(() => usePendingPermissions());

      act(() => {
        emitBashRequest(mockEmit, {
          controlRequestId: 'ctrl-no-reason',
          toolUseId: 'tool-no-reason',
        });
      });

      act(() => {
        result.current.deny('ctrl-no-reason');
      });

      expect(mockDeny).toHaveBeenCalledTimes(1);
      const [, , reasonArg] = mockDeny.mock.calls[0];
      // When no reason is given, the reason argument must be falsy (undefined or absent)
      expect(reasonArg).toBeFalsy();
    });

    it('removes the request from pending after deny', () => {
      const { result } = renderHook(() => usePendingPermissions());

      act(() => {
        emitBashRequest(mockEmit, {
          controlRequestId: 'ctrl-rm',
          toolUseId: 'tool-rm',
        });
      });

      expect(result.current.pending).not.toBeNull();

      act(() => {
        result.current.deny('ctrl-rm');
      });

      expect(result.current.pending).toBeNull();
    });
  });

  describe('type signature: deny(controlRequestId, reason?)', () => {
    it('deny function signature accepts an optional second string parameter', () => {
      const { result } = renderHook(() => usePendingPermissions());

      // The deny function must accept (controlRequestId: string, reason?: string)
      // This assertion verifies the TypeScript-level API via runtime call.
      act(() => {
        emitBashRequest(mockEmit, { controlRequestId: 'sig-test', toolUseId: 'sig-tool' });
      });

      // Call with explicit reason — must not throw
      expect(() => {
        act(() => {
          result.current.deny('sig-test', 'some reason');
        });
      }).not.toThrow();
    });
  });

  describe('UsePendingPermissionsReturn interface', () => {
    it('deny property on the returned object accepts two arguments', () => {
      const { result } = renderHook(() => usePendingPermissions());

      act(() => {
        emitBashRequest(mockEmit, { controlRequestId: 'iface-ctrl', toolUseId: 'iface-tool' });
      });

      // Verify the function accepts two args without error
      let error: unknown;
      act(() => {
        try {
          result.current.deny('iface-ctrl', 'a reason');
        } catch (e) {
          error = e;
        }
      });

      expect(error).toBeUndefined();
      expect(mockDeny).toHaveBeenCalledWith('iface-tool', 'iface-ctrl', 'a reason');
    });
  });
});
