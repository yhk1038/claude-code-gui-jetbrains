import { describe, it, expect } from 'vitest';
import { registryServerToPrefill } from '../useMcpRegistry';
import { McpTransportType, McpRegistryServer } from '@/shared';

function makeServer(over: Partial<McpRegistryServer>): McpRegistryServer {
  return {
    name: 'io.github.acme/widget',
    description: '',
    version: '1.0.0',
    repositoryUrl: null,
    config: { type: McpTransportType.STDIO, command: 'npx', args: ['-y', 'widget-mcp'] },
    requiredInputs: [],
    ...over,
  };
}

describe('registryServerToPrefill', () => {
  it('shortens a reverse-DNS name to its last path segment', () => {
    const { name } = registryServerToPrefill(makeServer({ name: 'io.github.acme/widget' }));
    expect(name).toBe('widget');
  });

  it('keeps the name as-is when there is no slash', () => {
    const { name } = registryServerToPrefill(makeServer({ name: 'plainname' }));
    expect(name).toBe('plainname');
  });

  it('stringifies the config as pretty JSON the parser can read back', () => {
    const { json } = registryServerToPrefill(makeServer({}));
    expect(JSON.parse(json)).toEqual({
      type: McpTransportType.STDIO,
      command: 'npx',
      args: ['-y', 'widget-mcp'],
    });
  });

  it('returns empty json when the entry has no installable config', () => {
    const { json } = registryServerToPrefill(makeServer({ config: null }));
    expect(json).toBe('');
  });
});
