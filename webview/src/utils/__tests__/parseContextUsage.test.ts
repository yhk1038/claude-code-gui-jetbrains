import { describe, it, expect } from 'vitest';
import {
  parseContextUsage,
  parseTokenValue,
  extractContextDetailMarkdown,
} from '../parseContextUsage';

const SAMPLE = `## Context Usage

**Model:** claude-opus-4-8[1m]
**Tokens:** 58.3k / 1m (6%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.4k | 0.2% |
| System tools | 11.2k | 1.1% |
| System tools (deferred) | 10k | 1.0% |
| Custom agents | 1.7k | 0.2% |
| Memory files | 37.8k | 3.8% |
| Skills | 5.2k | 0.5% |
| Messages | 8 | 0.0% |
| Free space | 941.7k | 94.2% |

### Custom Agents
| Agent Type | Source | Tokens |
|------------|--------|--------|
| architect | project | 1.7k |

### Memory Files
| Type | Path | Tokens |
|------|------|--------|
| User | ~/.claude/CLAUDE.md | 37.8k |

### Skills
| Skill | Source | Tokens |
|-------|--------|--------|
| deploy | project | 5.2k |
`;

describe('parseTokenValue', () => {
  it('parses k/m/b units and raw numbers', () => {
    expect(parseTokenValue('2.4k')).toBe(2400);
    expect(parseTokenValue('941.7k')).toBe(941700);
    expect(parseTokenValue('10k')).toBe(10000);
    expect(parseTokenValue('8')).toBe(8);
    expect(parseTokenValue('1m')).toBe(1000000);
    expect(parseTokenValue('1.2m')).toBe(1200000);
    expect(parseTokenValue('2b')).toBe(2000000000);
  });

  it('is case-insensitive and tolerates surrounding space', () => {
    expect(parseTokenValue('  5K ')).toBe(5000);
    expect(parseTokenValue('1M')).toBe(1000000);
  });

  it('strips thousands separators', () => {
    expect(parseTokenValue('1,234')).toBe(1234);
  });

  it('returns NaN for unreadable labels', () => {
    expect(Number.isNaN(parseTokenValue('abc'))).toBe(true);
    expect(Number.isNaN(parseTokenValue(''))).toBe(true);
  });
});

describe('parseContextUsage', () => {
  it('parses the full context report', () => {
    const result = parseContextUsage(SAMPLE);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.model).toBe('claude-opus-4-8[1m]');
    expect(result.tokensUsedLabel).toBe('58.3k');
    expect(result.tokensTotalLabel).toBe('1m');
    expect(result.percentUsed).toBe(6);
  });

  it('extracts every category row verbatim, including Free space', () => {
    const result = parseContextUsage(SAMPLE);
    if (!result) throw new Error('expected a parse result');

    expect(result.categories).toHaveLength(8);
    const first = result.categories[0];
    expect(first.name).toBe('System prompt');
    expect(first.tokensLabel).toBe('2.4k');
    expect(first.tokens).toBe(2400);
    expect(first.percent).toBe(0.2);

    const free = result.categories.find((c) => c.name === 'Free space');
    expect(free?.tokens).toBe(941700);
    expect(free?.percent).toBe(94.2);

    const messages = result.categories.find((c) => c.name === 'Messages');
    expect(messages?.tokens).toBe(8);
  });

  it('preserves category names that contain pipe-free parentheses', () => {
    const result = parseContextUsage(SAMPLE);
    if (!result) throw new Error('expected a parse result');
    const deferred = result.categories.find((c) => c.name === 'System tools (deferred)');
    expect(deferred?.tokens).toBe(10000);
  });

  it('returns null for non-context markdown', () => {
    expect(parseContextUsage('# Hello\n\nJust a normal reply.')).toBeNull();
  });

  it('returns null when the header is present but the category table is missing', () => {
    const md = `## Context Usage\n\n**Model:** x\n\nNo table here.`;
    expect(parseContextUsage(md)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseContextUsage('')).toBeNull();
  });

  it('still parses when the summary line is absent', () => {
    const md = `## Context Usage

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.4k | 0.2% |
| Free space | 900k | 99.8% |
`;
    const result = parseContextUsage(md);
    expect(result).not.toBeNull();
    expect(result?.tokensUsedLabel).toBe('');
    expect(result?.percentUsed).toBe(0);
    expect(result?.categories).toHaveLength(2);
  });
});

const SAMPLE_WITH_MCP = `## Context Usage

**Model:** claude-opus-4-8[1m]
**Tokens:** 58.3k / 1m (6%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.4k | 0.2% |
| MCP tools (deferred) | 3.1k | 0.3% |
| Free space | 941.7k | 94.2% |

### Custom Agents

| Agent Type | Source | Tokens |
|------------|--------|--------|
| oh-my-claudecode:analyst | Plugin | 40 |
| oh-my-claudecode:writer | Plugin | 42 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| email-writing | User | ~50 |
| deploy | Project | ~130 |
| oh-my-claudecode:analyze | Plugin (oh-my-claudecode) | < 20 |

### MCP Tools

| Tool | Server | Tokens |
|------|--------|--------|
| mcp__claude_ai_Gmail__create_draft | claude_ai_Gmail | 1.5k |
| mcp__claude_ai_Gmail__list_threads | claude_ai_Gmail | 900 |
| mcp__workspace__search | workspace-mcp | 700 |
`;

describe('parseContextUsage detail sections', () => {
  it('parses Custom Agents / Memory Files / Skills from the base sample', () => {
    const result = parseContextUsage(SAMPLE);
    if (!result) throw new Error('expected a parse result');

    expect(result.customAgents).toEqual([
      { name: 'architect', source: 'project', tokensLabel: '1.7k' },
    ]);
    expect(result.memoryFiles).toEqual([
      { type: 'User', path: '~/.claude/CLAUDE.md', tokensLabel: '37.8k' },
    ]);
    expect(result.skills).toEqual([
      { name: 'deploy', source: 'project', tokensLabel: '5.2k' },
    ]);
  });

  it('returns an empty MCP array when the section is absent', () => {
    const result = parseContextUsage(SAMPLE);
    expect(result?.mcpTools).toEqual([]);
  });

  it('leaves detail arrays empty when only the category table is present', () => {
    const md = `## Context Usage

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.4k | 0.2% |
| Free space | 900k | 99.8% |
`;
    const result = parseContextUsage(md);
    if (!result) throw new Error('expected a parse result');
    expect(result.customAgents).toEqual([]);
    expect(result.memoryFiles).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.mcpTools).toEqual([]);
  });

  it('parses MCP Tools with Server + verbatim token labels', () => {
    const result = parseContextUsage(SAMPLE_WITH_MCP);
    if (!result) throw new Error('expected a parse result');

    expect(result.mcpTools).toEqual([
      { tool: 'mcp__claude_ai_Gmail__create_draft', server: 'claude_ai_Gmail', tokensLabel: '1.5k' },
      { tool: 'mcp__claude_ai_Gmail__list_threads', server: 'claude_ai_Gmail', tokensLabel: '900' },
      { tool: 'mcp__workspace__search', server: 'workspace-mcp', tokensLabel: '700' },
    ]);
  });

  it('includes the "MCP tools (deferred)" category row in order', () => {
    const result = parseContextUsage(SAMPLE_WITH_MCP);
    const names = result?.categories.map((c) => c.name);
    expect(names).toEqual(['System prompt', 'MCP tools (deferred)', 'Free space']);
  });

  it('preserves verbatim approximate/threshold token labels in Skills', () => {
    const result = parseContextUsage(SAMPLE_WITH_MCP);
    if (!result) throw new Error('expected a parse result');
    expect(result.skills.map((s) => s.tokensLabel)).toEqual(['~50', '~130', '< 20']);
    // Source order is preserved exactly as the CLI printed it.
    expect(result.skills.map((s) => s.source)).toEqual([
      'User',
      'Project',
      'Plugin (oh-my-claudecode)',
    ]);
  });
});

describe('extractContextDetailMarkdown', () => {
  it('returns the detail sections after the category table', () => {
    const detail = extractContextDetailMarkdown(SAMPLE);
    expect(detail).toContain('### Custom Agents');
    expect(detail).toContain('### Memory Files');
    expect(detail).toContain('### Skills');
    // The summary + category table must NOT leak into the detail slice.
    expect(detail).not.toContain('Estimated usage by category');
    expect(detail).not.toContain('**Model:**');
  });

  it('returns an empty string when there are no detail sections', () => {
    const md = `## Context Usage

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.4k | 0.2% |
| Free space | 900k | 99.8% |
`;
    expect(extractContextDetailMarkdown(md)).toBe('');
  });
});
