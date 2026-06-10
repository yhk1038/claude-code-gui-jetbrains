import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { extractSessionInfo } from '../extractSessionInfo';

describe('extractSessionInfo', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'extract-session-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeJsonl(lines: string[]): Promise<string> {
    const filePath = join(tmpDir, `session-${Math.random().toString(36).slice(2)}.jsonl`);
    await writeFile(filePath, lines.join('\n'));
    return filePath;
  }

  describe('extractSessionInfo()', () => {
    it('should extract title from summary entry', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Hello world' }] },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Hi there' }] },
        }),
        JSON.stringify({
          type: 'summary',
          leafUuid: 'u2',
          summary: 'Greeting conversation',
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Greeting conversation');
      expect(result.messageCount).toBe(2);
      expect(result.isSidechain).toBe(false);
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should use first user prompt as title when no summary exists', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Build me a React app' }] },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Sure!' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Build me a React app');
    });

    it('should return "No title" when no summary or user prompt exists', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'assistant',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('No title');
    });

    it('should detect sidechain session from first message', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          isSidechain: true,
          message: { content: 'test' },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.isSidechain).toBe(true);
      expect(result.title).toBe('Sidechain Session');
    });

    it('should return "Empty Session" when no user or assistant messages exist', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'system',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: 'init' },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Empty Session');
      expect(result.isSidechain).toBe(true);
    });

    it('should extract lastTimestamp from the latest message', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Hi' }] },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T12:00:00Z',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }),
        JSON.stringify({
          uuid: 'u3',
          parentUuid: 'u2',
          type: 'user',
          timestamp: '2025-01-02T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Bye' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.lastTimestamp).toBe('2025-01-02T00:00:00Z');
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should skip malformed JSON lines gracefully', async () => {
      const filePath = await writeJsonl([
        'not valid json',
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }),
        '{"broken',
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Hi' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Hello');
      expect(result.messageCount).toBe(2); // only valid lines counted
    });

    it('should handle string content in messages', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: 'Plain string content' },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Plain string content');
    });

    it('should remove system tags from user prompt title', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: {
            content: [
              {
                type: 'text',
                text: '<system-tag>hidden</system-tag>Build a web app',
              },
            ],
          },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Sure' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Build a web app');
    });

    it('should skip isMeta user messages for title extraction', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          isMeta: true,
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Meta message' }] },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'user',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Real user message' }] },
        }),
        JSON.stringify({
          uuid: 'u3',
          parentUuid: 'u2',
          type: 'assistant',
          timestamp: '2025-01-01T00:02:00Z',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Real user message');
    });

    it('falls back to a meta user prompt when the first non-meta entry is only system tags', async () => {
      // Reproduces the /init (slash-command) shape: the first user entry is just
      // the command tags, and the real expanded prompt arrives as an isMeta entry.
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: '<command-message>init</command-message>\n<command-name>/init</command-name>' },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'user',
          isMeta: true,
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Please analyze this codebase and create a CLAUDE.md file' }] },
        }),
        JSON.stringify({
          uuid: 'u3',
          parentUuid: 'u2',
          type: 'assistant',
          timestamp: '2025-01-01T00:02:00Z',
          message: { content: [{ type: 'text', text: 'Done' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Please analyze this codebase and create a CLAUDE.md file');
    });

    it('skips a tag-only user prompt and uses the next meaningful non-meta prompt', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: '<command-name>/clear</command-name>' },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'user',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'What does this function do?' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('What does this function do?');
    });

    it('never leaks raw command tags as the title', async () => {
      // Only tag-only prompts and an assistant reply — no meaningful text anywhere.
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: '<command-message>compact</command-message>\n<command-name>/compact</command-name>' },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'ok' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).not.toContain('<');
      expect(result.title).toBe('No title');
    });

    it('prefers a non-meta prompt over a meta prompt when both are meaningful', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          isMeta: true,
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Meta expanded prompt' }] },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'user',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Real typed message' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Real typed message');
    });

    it('should handle empty lines', async () => {
      const filePath = await writeJsonl([
        '',
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Hi' }] },
        }),
        '',
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Hello' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Hi');
      expect(result.messageCount).toBe(2);
    });

    it('should use last text block from content array for title', async () => {
      const filePath = await writeJsonl([
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: {
            content: [
              { type: 'image', data: 'base64data' },
              { type: 'text', text: 'First text' },
              { type: 'text', text: 'Second text' },
            ],
          },
        }),
        JSON.stringify({
          uuid: 'u2',
          parentUuid: 'u1',
          type: 'assistant',
          timestamp: '2025-01-01T00:01:00Z',
          message: { content: [{ type: 'text', text: 'Response' }] },
        }),
      ]);

      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Second text');
    });

    // Regression test for issue #19: large JSONL must not stall or exhaust memory.
    it('should handle multi-megabyte JSONL without loading the whole file', async () => {
      const lines: string[] = [];
      lines.push(
        JSON.stringify({
          uuid: 'u0',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          message: { content: [{ type: 'text', text: 'Start' }] },
        }),
      );

      // ~10 MB worth of assistant chatter (10,000 lines × ~1KB).
      const bulk = 'A'.repeat(1000);
      for (let i = 1; i <= 10_000; i++) {
        lines.push(
          JSON.stringify({
            uuid: `u${i}`,
            parentUuid: `u${i - 1}`,
            type: i % 2 === 0 ? 'user' : 'assistant',
            timestamp: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
            message: { content: [{ type: 'text', text: bulk }] },
          }),
        );
      }
      lines.push(
        JSON.stringify({
          uuid: 'uLast',
          parentUuid: 'u10000',
          type: 'assistant',
          timestamp: '2025-12-31T23:59:59Z',
          message: { content: [{ type: 'text', text: 'End' }] },
        }),
      );

      const filePath = await writeJsonl(lines);
      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Start');
      expect(result.messageCount).toBe(10_002);
      expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(result.lastTimestamp).toBe('2025-12-31T23:59:59Z');
      expect(result.isSidechain).toBe(false);
    }, 15_000);

    // Regression test for issue #19: sidechain detection should short-circuit.
    it('should stop reading at first sidechain entry without scanning the rest', async () => {
      const lines: string[] = [
        JSON.stringify({
          uuid: 'u1',
          parentUuid: null,
          type: 'user',
          timestamp: '2025-01-01T00:00:00Z',
          isSidechain: true,
          message: { content: [{ type: 'text', text: 'sidechain start' }] },
        }),
      ];
      // Append lots of garbage that, if parsed, would explode.
      for (let i = 0; i < 5000; i++) {
        lines.push('{"broken json that should never be read');
      }

      const filePath = await writeJsonl(lines);
      const result = await extractSessionInfo(filePath);

      expect(result.title).toBe('Sidechain Session');
      expect(result.isSidechain).toBe(true);
    });
  });
});
