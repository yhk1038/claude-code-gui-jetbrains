import {describe, it, expect, vi} from 'vitest';
import {screen, fireEvent} from '@testing-library/react';
import {SearchTextRenderer} from '../SearchTextRenderer';
import {SearchFileRenderer} from '../SearchFileRenderer';
import {ReadFileRenderer} from '../ReadFileRenderer';
import {ReplaceTextRenderer} from '../ReplaceTextRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

/**
 * WebStorm 2025.2+ ships newer built-in MCP tool names for the same operations.
 * The payloads (captured live) differ from the older tools — search returns
 * `{entries:[{filePath,lineNumber}]}` (not `{items}`) and file-find returns
 * `{files:[path]}`. These bind the newer names to the existing rich renderers.
 */
describe('newer JetBrains MCP tool names render as rich cards', () => {
    it('search_in_files_by_text: entries + lineNumber render as path:line rows and jump', () => {
        renderWithStatus(
            <SearchTextRenderer
                toolUse={makeToolUse({searchText: 'useToolStatus'}, 'mcp__webstorm__search_in_files_by_text')}
                toolResult={makeToolResult(JSON.stringify({entries: [
                    {filePath: 'a/toolStatus.ts', lineNumber: 42, lineText: 'export function ||useToolStatus||()'},
                    {filePath: 'a/index.tsx', lineNumber: 6, lineText: 'import {||useToolStatus||}'},
                ]}))}
            />,
        );
        expect(screen.getByText('2 matches')).toBeInTheDocument();
        expect(screen.getByText('useToolStatus')).toBeInTheDocument(); // the query in the header
        fireEvent.click(screen.getByText('a/toolStatus.ts:42'));
        expect(mockOpenFile).toHaveBeenCalledWith('a/toolStatus.ts', 42);
    });

    it('search_in_files_by_regex: same entries shape', () => {
        renderWithStatus(
            <SearchTextRenderer
                toolUse={makeToolUse({regexPattern: 'foo.*'}, 'mcp__webstorm__search_in_files_by_regex')}
                toolResult={makeToolResult(JSON.stringify({entries: [{filePath: 'x.ts', lineNumber: 3}]}))}
            />,
        );
        expect(screen.getByText('1 match')).toBeInTheDocument();
        expect(screen.getByText('x.ts:3')).toBeInTheDocument();
    });

    it('find_files_by_glob: files[] render as rows with a "+more" hint', () => {
        renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({globPattern: '**/*.tsx', fileCountLimit: 3}, 'mcp__webstorm__find_files_by_glob')}
                toolResult={makeToolResult(JSON.stringify({
                    probablyHasMoreMatchingFiles: true,
                    files: ['src/A.tsx', 'src/B.tsx', 'src/C.tsx'],
                }))}
            />,
        );
        expect(screen.getByText('3+ matches')).toBeInTheDocument();
        expect(screen.getByText('src/B.tsx')).toBeInTheDocument();
    });

    it('find_files_by_name_keyword: files[] without the more hint', () => {
        renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({nameKeyword: 'toolStatus'}, 'mcp__webstorm__find_files_by_name_keyword')}
                toolResult={makeToolResult(JSON.stringify({files: ['a/toolStatus.ts']}))}
            />,
        );
        expect(screen.getByText('1 match')).toBeInTheDocument();
        expect(screen.getByText('a/toolStatus.ts')).toBeInTheDocument();
    });

    it('get_file_text_by_path: resolves pathInProject and shows raw text', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({pathInProject: 'src/toolStatus.ts'}, 'mcp__webstorm__get_file_text_by_path')}
                toolResult={makeToolResult('export const x = 1;\n')}
            />,
        );
        expect(screen.getByText('toolStatus.ts')).toBeInTheDocument(); // basename link
        expect(screen.getByText(/export const x = 1;/)).toBeInTheDocument();
    });

    it('replace_text_in_file: shows file link, old -> new, and flags', () => {
        renderWithStatus(
            <ReplaceTextRenderer
                toolUse={makeToolUse(
                    {pathInProject: 'src/a.ts', oldText: 'foo', newText: 'bar', replaceAll: true, caseSensitive: true},
                    'mcp__webstorm__replace_text_in_file',
                )}
                toolResult={makeToolResult('')}
            />,
        );
        expect(screen.getByText('Replace in file')).toBeInTheDocument();
        expect(screen.getByText('foo')).toBeInTheDocument();
        expect(screen.getByText('bar')).toBeInTheDocument();
        expect(screen.getByText('all')).toBeInTheDocument();
        expect(screen.getByText('case-sensitive')).toBeInTheDocument();
    });
});

describe('newer tool names tolerate malformed payloads', () => {
    it('search_in_files entries with null / non-string element', () => {
        expect(() => renderWithStatus(
            <SearchTextRenderer
                toolUse={makeToolUse({searchText: 'x'}, 'mcp__webstorm__search_in_files_by_text')}
                toolResult={makeToolResult('{"entries":[null,{"filePath":5,"lineNumber":"x"}]}')}
            />,
        )).not.toThrow();
    });

    it('find_files with a non-array files field', () => {
        expect(() => renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({globPattern: '*'}, 'mcp__webstorm__find_files_by_glob')}
                toolResult={makeToolResult('{"files":"nope"}')}
            />,
        )).not.toThrow();
    });

    it('replace_text_in_file with non-string old/new text', () => {
        expect(() => renderWithStatus(
            <ReplaceTextRenderer
                toolUse={makeToolUse({pathInProject: 5, oldText: 1, newText: {}}, 'mcp__webstorm__replace_text_in_file')}
                toolResult={makeToolResult('{}')}
            />,
        )).not.toThrow();
    });
});
