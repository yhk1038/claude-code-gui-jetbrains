import { describe, it, expect, vi } from 'vitest';
import { mergeDisabledServers } from '../mcp-manager';
import { McpServerStatus, McpServerScope, McpTransportType } from '../../../shared';
import type { McpServer } from '../../../shared';

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
