import { describe, it, expect } from 'vitest';
import { normalizeRegistryServer } from '../mcp-registry';
import { McpTransportType } from '../../../shared';

// Sample raw entries mirror the real official-registry shape:
//   GET https://registry.modelcontextprotocol.io/v0/servers
// Each item is { server: {...}, _meta: {...} }; the installable data lives in
// packages[] (stdio) and remotes[] (http/sse).

describe('normalizeRegistryServer', () => {
  it('returns null when the entry has no server object', () => {
    expect(normalizeRegistryServer({ _meta: {} })).toBeNull();
    expect(normalizeRegistryServer(null)).toBeNull();
    expect(normalizeRegistryServer('nope')).toBeNull();
  });

  it('maps top-level metadata (name, description, version, repository url)', () => {
    const r = normalizeRegistryServer({
      server: {
        name: 'io.github.acme/widget',
        description: 'A widget server',
        version: '1.2.3',
        repository: { url: 'https://github.com/acme/widget', source: 'github' },
        packages: [{ registryType: 'npm', identifier: 'widget-mcp', transport: { type: 'stdio' } }],
      },
    });
    expect(r).not.toBeNull();
    expect(r!.name).toBe('io.github.acme/widget');
    expect(r!.description).toBe('A widget server');
    expect(r!.version).toBe('1.2.3');
    expect(r!.repositoryUrl).toBe('https://github.com/acme/widget');
  });

  it('defaults missing description/version to empty string and repositoryUrl to null', () => {
    const r = normalizeRegistryServer({
      server: { name: 'x', packages: [{ registryType: 'npm', identifier: 'x-mcp' }] },
    });
    expect(r!.description).toBe('');
    expect(r!.version).toBe('');
    expect(r!.repositoryUrl).toBeNull();
  });

  describe('npm package → stdio config', () => {
    it('builds command=npx with -y and the package identifier', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'n',
          packages: [{
            registryType: 'npm',
            identifier: 'my-mcp-server',
            runtimeHint: 'npx',
            transport: { type: 'stdio' },
            runtimeArguments: [{ value: '-y', type: 'positional' }],
          }],
        },
      });
      expect(r!.config).toEqual({
        type: McpTransportType.STDIO,
        command: 'npx',
        args: ['-y', 'my-mcp-server'],
      });
      expect(r!.requiredInputs).toEqual([]);
    });

    it('falls back to npx when runtimeHint is absent', () => {
      const r = normalizeRegistryServer({
        server: { name: 'n', packages: [{ registryType: 'npm', identifier: 'pkg' }] },
      });
      expect(r!.config).toMatchObject({ command: 'npx', args: ['pkg'] });
    });

    it('uses uvx for pypi packages', () => {
      const r = normalizeRegistryServer({
        server: { name: 'n', packages: [{ registryType: 'pypi', identifier: 'py-mcp' }] },
      });
      expect(r!.config).toMatchObject({ command: 'uvx', args: ['py-mcp'] });
    });

    it('includes only required env vars (blank values) and lists them in requiredInputs', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'n',
          packages: [{
            registryType: 'npm',
            identifier: 'pkg',
            environmentVariables: [
              { name: 'REQ_KEY', isRequired: true },
              { name: 'OPT_KEY' },
              { name: 'REQ_DEFAULT', isRequired: true, default: 'x' },
            ],
          }],
        },
      });
      expect(r!.config).toMatchObject({
        env: { REQ_KEY: '', REQ_DEFAULT: 'x' },
      });
      expect(r!.config!.env).not.toHaveProperty('OPT_KEY');
      expect(r!.requiredInputs).toEqual(['REQ_KEY', 'REQ_DEFAULT']);
    });

    it('appends package arguments after the identifier (named → flag + value, positional → value)', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'n',
          packages: [{
            registryType: 'npm',
            identifier: 'pkg',
            runtimeArguments: [{ value: '-y', type: 'positional' }],
            packageArguments: [
              { type: 'named', name: '--port', value: '8080' },
              { type: 'positional', value: '/data' },
            ],
          }],
        },
      });
      // runtime args, then identifier, then package args
      expect(r!.config!.args).toEqual(['-y', 'pkg', '--port', '8080', '/data']);
    });
  });

  describe('remote → http/sse config', () => {
    it('maps streamable-http to HTTP transport', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'r',
          remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
        },
      });
      expect(r!.config).toEqual({ type: McpTransportType.HTTP, url: 'https://example.com/mcp' });
    });

    it('maps sse to SSE transport', () => {
      const r = normalizeRegistryServer({
        server: { name: 'r', remotes: [{ type: 'sse', url: 'https://example.com/sse' }] },
      });
      expect(r!.config).toMatchObject({ type: McpTransportType.SSE, url: 'https://example.com/sse' });
    });

    it('includes required headers (placeholder values kept) and lists them in requiredInputs', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'r',
          remotes: [{
            type: 'streamable-http',
            url: 'https://server.smithery.ai/mcp',
            headers: [
              { name: 'Authorization', value: 'Bearer {smithery_api_key}', isRequired: true },
              { name: 'X-Optional', value: 'maybe' },
            ],
          }],
        },
      });
      expect(r!.config).toMatchObject({
        headers: { Authorization: 'Bearer {smithery_api_key}' },
      });
      expect(r!.config!.headers).not.toHaveProperty('X-Optional');
      expect(r!.requiredInputs).toEqual(['Authorization']);
    });
  });

  describe('package vs remote precedence', () => {
    it('prefers a stdio package over a remote when both are present', () => {
      const r = normalizeRegistryServer({
        server: {
          name: 'both',
          packages: [{ registryType: 'npm', identifier: 'pkg' }],
          remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
        },
      });
      expect(r!.config).toMatchObject({ type: McpTransportType.STDIO, command: 'npx' });
    });
  });

  it('returns config=null when there is neither a package nor a remote', () => {
    const r = normalizeRegistryServer({ server: { name: 'empty' } });
    expect(r!.config).toBeNull();
    expect(r!.requiredInputs).toEqual([]);
  });
});
