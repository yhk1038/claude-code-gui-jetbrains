import { describe, it, expect } from 'vitest';
import { mapMcpTool, buildTransport } from '../mcp-tools';
import { McpTransportType } from '../../../shared';
import type { McpServerConfig } from '../../../shared';

describe('mapMcpTool', () => {
  it('keeps only the name when no annotations are present', () => {
    expect(mapMcpTool({ name: 'playwright_navigate' })).toEqual({ name: 'playwright_navigate' });
  });

  it('omits the annotations object when annotations is empty', () => {
    expect(mapMcpTool({ name: 't', annotations: {} })).toEqual({ name: 't' });
  });

  it('maps readOnlyHint -> readOnly', () => {
    expect(mapMcpTool({ name: 't', annotations: { readOnlyHint: true } })).toEqual({
      name: 't',
      annotations: { readOnly: true },
    });
  });

  it('maps destructiveHint -> destructive', () => {
    expect(mapMcpTool({ name: 't', annotations: { destructiveHint: true } })).toEqual({
      name: 't',
      annotations: { destructive: true },
    });
  });

  it('maps both hints together', () => {
    expect(
      mapMcpTool({ name: 't', annotations: { readOnlyHint: false, destructiveHint: true } }),
    ).toEqual({ name: 't', annotations: { readOnly: false, destructive: true } });
  });
});

describe('buildTransport', () => {
  it('returns a transport for a stdio server with a command', async () => {
    const config: McpServerConfig = {
      type: McpTransportType.STDIO,
      command: 'npx',
      args: ['@executeautomation/playwright-mcp-server'],
    };
    expect(await buildTransport(config)).not.toBeNull();
  });

  it('returns null for a stdio server without a command', async () => {
    expect(await buildTransport({ type: McpTransportType.STDIO })).toBeNull();
  });

  it('returns a transport for an http server with a url', async () => {
    expect(await buildTransport({ type: McpTransportType.HTTP, url: 'http://localhost:8000/mcp' })).not.toBeNull();
  });

  it('returns a transport for an sse server with a url', async () => {
    expect(await buildTransport({ type: McpTransportType.SSE, url: 'http://localhost:64342/sse' })).not.toBeNull();
  });

  it('returns null for http/sse without a url', async () => {
    expect(await buildTransport({ type: McpTransportType.HTTP })).toBeNull();
    expect(await buildTransport({ type: McpTransportType.SSE })).toBeNull();
  });

  it('returns null for claudeai-proxy (needs OAuth, not directly probeable)', async () => {
    expect(await buildTransport({ type: McpTransportType.CLAUDEAI_PROXY, url: 'https://example' })).toBeNull();
  });
});
