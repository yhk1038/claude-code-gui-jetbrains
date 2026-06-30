import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeDisabledServers, addMcpServer, removeMcpServer, extractServerConfig } from '../mcp-manager';
import { Claude } from '../../claude';
import { McpServerStatus, McpServerScope, McpTransportType } from '../../../shared';
import type { McpServer } from '../../../shared';

vi.mock('../../claude', () => ({ Claude: { exec: vi.fn() } }));

function server(name: string, overrides: Partial<McpServer> = {}): McpServer {
  return {
    name,
    status: McpServerStatus.FAILED,
    scope: McpServerScope.USER,
    config: { type: McpTransportType.SSE, url: 'http://localhost:64342/sse' },
    tools: [],
    error: 'Unable to connect: connection refused.',
    ...overrides,
  };
}

describe('mergeDisabledServers', () => {
  // Regression: `claude mcp list` still reports disabled servers (it ignores
  // disabledMcpServers), so a server present in the list AND in the disabled
  // set must be overridden to DISABLED — not left as its live FAILED status.
  it('overrides a disabled server that still appears in the list', async () => {
    const servers = [server('jetbrains'), server('playwright', { status: McpServerStatus.CONNECTED, error: null })];
    const fetchDetails = vi.fn();

    await mergeDisabledServers(servers, ['jetbrains'], fetchDetails);

    const jetbrains = servers.find((s) => s.name === 'jetbrains')!;
    expect(jetbrains.status).toBe(McpServerStatus.DISABLED);
    expect(jetbrains.error).toBeNull();
    // Non-disabled server is untouched.
    expect(servers.find((s) => s.name === 'playwright')!.status).toBe(McpServerStatus.CONNECTED);
    // No synthetic fetch needed since it was already in the list.
    expect(fetchDetails).not.toHaveBeenCalled();
  });

  it('adds a synthetic DISABLED entry for a config-only disabled server, forcing DISABLED even if details report FAILED', async () => {
    const servers: McpServer[] = [];
    // Even though `claude mcp get` reports FAILED, the merged entry must be DISABLED.
    const fetchDetails = vi.fn().mockResolvedValue(server('config-only', { status: McpServerStatus.FAILED }));

    await mergeDisabledServers(servers, ['config-only'], fetchDetails);

    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('config-only');
    expect(servers[0].status).toBe(McpServerStatus.DISABLED);
    expect(servers[0].error).toBeNull();
    // Config details (transport/url) are preserved from the fetch.
    expect(servers[0].config?.url).toBe('http://localhost:64342/sse');
    expect(fetchDetails).toHaveBeenCalledWith('config-only');
  });

  it('falls back to a minimal user-scope entry when details are unavailable', async () => {
    const servers: McpServer[] = [];
    const fetchDetails = vi.fn().mockResolvedValue(null);

    await mergeDisabledServers(servers, ['ghost'], fetchDetails);

    expect(servers).toEqual([
      {
        name: 'ghost',
        scope: McpServerScope.USER,
        config: null,
        tools: [],
        status: McpServerStatus.DISABLED,
        error: null,
      },
    ]);
  });

  it('is a no-op when the disabled list is empty', async () => {
    const servers = [server('jetbrains', { status: McpServerStatus.CONNECTED, error: null })];
    const fetchDetails = vi.fn();

    await mergeDisabledServers(servers, [], fetchDetails);

    expect(servers[0].status).toBe(McpServerStatus.CONNECTED);
    expect(fetchDetails).not.toHaveBeenCalled();
  });
});

// Regression: project/local scope writes `.mcp.json` relative to the CLI's cwd.
// Without forwarding the workspace root, the file landed in the backend's own
// directory (backend/.mcp.json) instead of the user's project. Every MCP
// command must run with cwd === workspace root.
describe('MCP commands run in the workspace cwd', () => {
  const execMock = vi.mocked(Claude.exec);

  beforeEach(() => {
    execMock.mockReset();
    execMock.mockResolvedValue({ stdout: 'Added', stderr: '' });
  });

  it('forwards cwd to `claude mcp add-json` so project scope writes at the workspace root', async () => {
    await addMcpServer('srv', { command: 'npx' }, 'project', '/ws/root');
    expect(execMock).toHaveBeenCalledWith(
      ['mcp', 'add-json', 'srv', JSON.stringify({ command: 'npx' }), '-s', 'project'],
      expect.objectContaining({ cwd: '/ws/root' }),
    );
  });

  it('forwards cwd to `claude mcp remove` to target the right project .mcp.json', async () => {
    await removeMcpServer('srv', 'project', '/ws/root');
    expect(execMock).toHaveBeenCalledWith(
      ['mcp', 'remove', 'srv', '-s', 'project'],
      expect.objectContaining({ cwd: '/ws/root' }),
    );
  });
});

// Regression: `claude mcp get` drops headers/env (and omits config entirely for
// non-connected servers). The settings file is the source of truth, so config
// recovery must return it verbatim — otherwise Edit would silently lose headers.
describe('extractServerConfig', () => {
  it('returns the server config verbatim, including headers', () => {
    const data = { mcpServers: { srv: { type: 'http', url: 'u', headers: { 'X-Test': '1' } } } };
    expect(extractServerConfig(data, 'srv')).toEqual({ type: 'http', url: 'u', headers: { 'X-Test': '1' } });
  });

  it('preserves stdio env verbatim', () => {
    const data = { mcpServers: { srv: { command: 'npx', args: ['x'], env: { API_KEY: 'secret' } } } };
    expect(extractServerConfig(data, 'srv')).toEqual({ command: 'npx', args: ['x'], env: { API_KEY: 'secret' } });
  });

  it('returns null when the server is absent or the shape is malformed', () => {
    expect(extractServerConfig({ mcpServers: {} }, 'srv')).toBeNull();
    expect(extractServerConfig({}, 'srv')).toBeNull();
    expect(extractServerConfig(null, 'srv')).toBeNull();
    expect(extractServerConfig({ mcpServers: { srv: 'not-an-object' } }, 'srv')).toBeNull();
  });
});
