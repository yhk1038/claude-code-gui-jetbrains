import {describe, it, expect} from 'vitest';
import {humanizeMcpToolName, mcpToolSessionScopeLabel} from '../humanize';

describe('MCP tool humanizer registry', () => {
    it('routes JetBrains tools through the JetBrains namer', () => {
        expect(humanizeMcpToolName('mcp__idea__create_new_file')).toBe('IntelliJ IDEA: Create new file');
        expect(humanizeMcpToolName('mcp__pycharm__git_status')).toBe('PyCharm: Git status');
    });

    it('falls back to the generic MCP formatter for unknown families', () => {
        expect(humanizeMcpToolName('mcp__claude_ai_Gmail__search_threads')).toContain('[search_threads]');
    });

    it('gives JetBrains a short session-scope label (quoted action only)', () => {
        expect(mcpToolSessionScopeLabel('mcp__idea__create_new_file')).toBe('"Create new file"');
    });

    it('uses the full generic label as the session scope for other families', () => {
        expect(mcpToolSessionScopeLabel('mcp__claude_ai_Gmail__search_threads'))
            .toBe(humanizeMcpToolName('mcp__claude_ai_Gmail__search_threads'));
    });
});
