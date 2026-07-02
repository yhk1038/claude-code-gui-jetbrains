import {describe, it, expect} from 'vitest';
import {getToolSpec, headerFilePath, surprisingFields} from '../_shared/tool-params';

describe('tool-params', () => {
    it('binds the real schema field names (not the stale docs)', () => {
        expect(getToolSpec('mcp__idea__reformat_file')?.filesParam).toBe('files');
        expect(getToolSpec('mcp__idea__xdebug_get_value_by_path')?.segmentsParam).toBe('path');
        expect(getToolSpec('mcp__idea__search_file')?.queryParam).toBe('q');
        expect(getToolSpec('mcp__idea__totally_unknown_tool')).toBeUndefined();
    });

    it('resolves the single header path from the spec', () => {
        expect(headerFilePath('mcp__pycharm__read_file', {file_path: 'src/a.py'})).toBe('src/a.py');
        // reformat takes a files[] array — there is no single header file path
        expect(headerFilePath('mcp__idea__reformat_file', {files: ['a.kt']})).toBeUndefined();
    });

    describe('surprisingFields (security notice)', () => {
        it('is empty for clean, well-typed input', () => {
            expect(surprisingFields('mcp__idea__search_file', {q: 'x', paths: ['src/'], limit: 5})).toEqual([]);
        });

        it('flags a key absent from the schema', () => {
            const out = surprisingFields('mcp__idea__read_file', {file_path: 'a', evil: 'rm -rf'});
            expect(out).toEqual([{key: 'evil', value: 'rm -rf', reason: 'unknown'}]);
        });

        it('flags a known key with the wrong type', () => {
            const out = surprisingFields('mcp__idea__get_file_problems', {filePath: 'a', timeout: 'soon'});
            expect(out).toEqual([{key: 'timeout', value: 'soon', reason: 'type'}]);
        });

        it('never flags projectPath (it is conveyed by the path display)', () => {
            expect(surprisingFields('mcp__idea__read_file', {file_path: 'a', projectPath: '/x'})).toEqual([]);
        });

        it('returns nothing for unmodeled tools (the generic renderer dumps all input)', () => {
            expect(surprisingFields('mcp__idea__totally_unknown_tool', {anything: 1})).toEqual([]);
        });
    });
});
