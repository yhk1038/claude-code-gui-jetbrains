import { describe, it, expect } from 'vitest';
import { parseMcpJson } from '../parseMcpJson';

describe('parseMcpJson', () => {
  describe('invalid input', () => {
    it('rejects empty input', () => {
      const r = parseMcpJson('', 'fallback');
      expect(r.ok).toBe(false);
    });

    it('rejects whitespace-only input', () => {
      const r = parseMcpJson('   \n  ', 'fallback');
      expect(r.ok).toBe(false);
    });

    it('rejects malformed JSON', () => {
      const r = parseMcpJson('{ not json', 'fallback');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.toLowerCase()).toContain('json');
    });

    it('rejects a JSON array at the top level', () => {
      const r = parseMcpJson('[1, 2, 3]', 'fallback');
      expect(r.ok).toBe(false);
    });

    it('rejects a JSON primitive at the top level', () => {
      const r = parseMcpJson('"hello"', 'fallback');
      expect(r.ok).toBe(false);
    });
  });

  describe('mcpServers wrapper form', () => {
    it('extracts a single stdio server from the wrapper, ignoring nameFallback', () => {
      const input = JSON.stringify({
        mcpServers: {
          'my-server': { command: 'npx', args: ['-y', 'my-mcp-server'] },
        },
      });
      const r = parseMcpJson(input, 'IGNORED');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.servers).toHaveLength(1);
        expect(r.servers[0].name).toBe('my-server');
        expect(r.servers[0].config).toEqual({ command: 'npx', args: ['-y', 'my-mcp-server'] });
      }
    });

    it('extracts multiple servers from the wrapper', () => {
      const input = JSON.stringify({
        mcpServers: {
          a: { command: 'cmd-a' },
          b: { type: 'http', url: 'https://example.com/mcp' },
        },
      });
      const r = parseMcpJson(input, '');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.servers).toHaveLength(2);
        expect(r.servers.map((s) => s.name).sort()).toEqual(['a', 'b']);
      }
    });

    it('preserves the original config verbatim (no key renaming or type injection)', () => {
      const config = { command: 'npx', args: ['x'], env: { K: 'v' } };
      const input = JSON.stringify({ mcpServers: { s: config } });
      const r = parseMcpJson(input, '');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.servers[0].config).toEqual(config);
    });

    it('rejects an empty mcpServers object', () => {
      const r = parseMcpJson(JSON.stringify({ mcpServers: {} }), 'fallback');
      expect(r.ok).toBe(false);
    });

    it('rejects a wrapper entry whose value is not an object', () => {
      const r = parseMcpJson(JSON.stringify({ mcpServers: { s: 'oops' } }), '');
      expect(r.ok).toBe(false);
    });

    it('rejects a wrapper entry with neither command nor url', () => {
      const r = parseMcpJson(JSON.stringify({ mcpServers: { s: { args: ['x'] } } }), '');
      expect(r.ok).toBe(false);
    });
  });

  describe('inner config form (no wrapper)', () => {
    it('uses nameFallback for a bare stdio config', () => {
      const input = JSON.stringify({ command: 'npx', args: ['-y', 'pkg'] });
      const r = parseMcpJson(input, 'my-name');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.servers).toHaveLength(1);
        expect(r.servers[0].name).toBe('my-name');
        expect(r.servers[0].config).toEqual({ command: 'npx', args: ['-y', 'pkg'] });
      }
    });

    it('accepts a bare remote (url) config', () => {
      const input = JSON.stringify({ type: 'http', url: 'https://example.com/mcp' });
      const r = parseMcpJson(input, 'remote');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.servers[0].config).toEqual({ type: 'http', url: 'https://example.com/mcp' });
    });

    it('rejects a bare config when nameFallback is empty', () => {
      const r = parseMcpJson(JSON.stringify({ command: 'npx' }), '');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.toLowerCase()).toContain('name');
    });

    it('rejects a bare config when nameFallback is whitespace', () => {
      const r = parseMcpJson(JSON.stringify({ command: 'npx' }), '   ');
      expect(r.ok).toBe(false);
    });

    it('trims the fallback name', () => {
      const r = parseMcpJson(JSON.stringify({ command: 'npx' }), '  spaced  ');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.servers[0].name).toBe('spaced');
    });

    it('rejects a bare config with neither command nor url', () => {
      const r = parseMcpJson(JSON.stringify({ foo: 'bar' }), 'name');
      expect(r.ok).toBe(false);
    });
  });
});
