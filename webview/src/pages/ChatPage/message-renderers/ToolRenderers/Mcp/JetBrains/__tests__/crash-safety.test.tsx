import {describe, it, expect, vi} from 'vitest';
import {SearchFileRenderer} from '../SearchFileRenderer';
import {SearchTextRenderer} from '../SearchTextRenderer';
import {OpenFilesRenderer} from '../OpenFilesRenderer';
import {GetRunConfigurationsRenderer} from '../GetRunConfigurationsRenderer';
import {GitStatusRenderer} from '../GitStatusRenderer';
import {ProblemsRenderer} from '../ProblemsRenderer';
import {CreateNewFileRenderer} from '../CreateNewFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: vi.fn()})}));

/**
 * A renderer must never throw on an untrusted payload — a model slip or a future
 * MCP schema change could send a non-array where an array is declared, or a
 * non-string where a path is declared. These would crash the card (and, without
 * the error boundary, blank the chat). Each case renders a malformed result /
 * input and asserts the render doesn't throw.
 */
describe('renderers tolerate malformed result payloads', () => {
    const badArrayPayloads: Array<[string, () => unknown]> = [
        ['search_file items as string', () => renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({q: '*'}, 'mcp__idea__search_file')}
                toolResult={makeToolResult('{"items":"5 matches"}')}
            />)],
        ['search_text items as object', () => renderWithStatus(
            <SearchTextRenderer
                toolUse={makeToolUse({q: '*'}, 'mcp__idea__search_text')}
                toolResult={makeToolResult('{"items":{"filePath":"a.ts"}}')}
            />)],
        ['open files as object with length', () => renderWithStatus(
            <OpenFilesRenderer
                toolUse={makeToolUse({}, 'mcp__idea__get_all_open_file_paths')}
                toolResult={makeToolResult('{"openFiles":{"length":2}}')}
            />)],
        ['run configurations as object', () => renderWithStatus(
            <GetRunConfigurationsRenderer
                toolUse={makeToolUse({}, 'mcp__idea__get_run_configurations')}
                toolResult={makeToolResult('{"configurations":{"name":"X"}}')}
            />)],
        ['git repositories as string', () => renderWithStatus(
            <GitStatusRenderer
                toolUse={makeToolUse({}, 'mcp__idea__git_status')}
                toolResult={makeToolResult('{"repositories":"db error"}')}
            />)],
        ['git entries as string', () => renderWithStatus(
            <GitStatusRenderer
                toolUse={makeToolUse({}, 'mcp__idea__git_status')}
                toolResult={makeToolResult('{"repositories":[{"entries":"nope"}]}')}
            />)],
        ['problems as string', () => renderWithStatus(
            <ProblemsRenderer
                toolUse={makeToolUse({}, 'mcp__idea__get_file_problems')}
                toolResult={makeToolResult('{"problems":"boom"}')}
            />)],
    ];

    it.each(badArrayPayloads)('does not throw: %s', (_label, run) => {
        expect(run).not.toThrow();
    });
});

describe('renderers tolerate non-string path/text inputs', () => {
    it('create_new_file with a numeric pathInProject and non-string text', () => {
        expect(() => renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({pathInProject: 123, text: 456}, 'mcp__idea__create_new_file')}
                toolResult={makeToolResult('{}')}
            />,
        )).not.toThrow();
    });

    it('read_file-style header with a non-string filePath', () => {
        // header path coercion: a non-string path must not reach the path helpers
        expect(() => renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({q: 42}, 'mcp__idea__search_file')}
                toolResult={makeToolResult('{"items":[{"filePath":99}]}')}
            />,
        )).not.toThrow();
    });
});
