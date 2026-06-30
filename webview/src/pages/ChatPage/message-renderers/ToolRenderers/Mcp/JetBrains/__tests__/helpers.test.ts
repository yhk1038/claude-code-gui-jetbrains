import {describe, it, expect} from 'vitest';
import {
    jetbrainsProductName, toolTitle, isJetBrainsTool, humanizeMcpToolName,
    isTrivialResult, safeParseJson, asArray, basename, joinProjectPath, inputProjectPath,
    dirname, valueType, typeMismatch, resultIndicatesError, debuggerOutcome, debuggerHasExtraPayload,
} from '../_shared/helpers';

describe('JetBrains _shared helpers', () => {
    it('maps the server segment to a product name', () => {
        expect(jetbrainsProductName('mcp__idea__create_new_file')).toBe('IntelliJ IDEA');
        expect(jetbrainsProductName('mcp__pycharm__read_file')).toBe('PyCharm');
        expect(jetbrainsProductName('mcp__webstorm__read_file')).toBe('WebStorm');
        // unknown launcher → sentence-cased fallback
        expect(jetbrainsProductName('mcp__fleet__read_file')).toBe('Fleet');
    });

    it('maps tool suffix to a human title (with prettified fallback)', () => {
        expect(toolTitle('mcp__idea__create_new_file')).toBe('Create new file');
        expect(toolTitle('mcp__pycharm__read_file')).toBe('Read file');
        expect(toolTitle('mcp__idea__some_future_tool')).toBe('Some future tool');
    });

    it('detects JetBrains tools', () => {
        expect(isJetBrainsTool('mcp__idea__read_file')).toBe(true);
        expect(isJetBrainsTool('mcp__pycharm__git_status')).toBe(true);
        expect(isJetBrainsTool('mcp__claude_ai_Gmail__search_threads')).toBe(false);
        expect(isJetBrainsTool('Bash')).toBe(false);
    });

    it('humanizes any MCP tool name', () => {
        expect(humanizeMcpToolName('mcp__idea__create_new_file')).toBe('IntelliJ IDEA: Create new file');
        expect(humanizeMcpToolName('mcp__claude_ai_Gmail__search_threads')).toContain('[search_threads]');
    });

    it('asArray coerces non-arrays to [] (never throws)', () => {
        expect(asArray([1, 2])).toEqual([1, 2]);
        expect(asArray('nope')).toEqual([]);
        expect(asArray({length: 3})).toEqual([]);
        expect(asArray(null)).toEqual([]);
        expect(asArray(undefined)).toEqual([]);
    });

    it('path helpers tolerate non-string input (no crash)', () => {
        // a model slip / schema change could send a number where a path is declared
        expect(basename(123 as unknown as string)).toBe('');
        expect(dirname(123 as unknown as string)).toBe('');
        expect(joinProjectPath('/tmp/proj', 123 as unknown as string)).toBe('');
    });

    it('flags trivial results', () => {
        expect(isTrivialResult('[success]')).toBe(true);
        expect(isTrivialResult('ok')).toBe(true);
        expect(isTrivialResult('{}')).toBe(true);
        expect(isTrivialResult('')).toBe(true);
        expect(isTrivialResult('hello')).toBe(false);
    });

    it('safeParseJson never throws', () => {
        expect(safeParseJson('{"a":1}')).toEqual({a: 1});
        expect(safeParseJson('nope')).toBeUndefined();
    });

    it('resolves project-relative paths against projectPath', () => {
        expect(joinProjectPath('/tmp/proj', 'src/app.py')).toBe('/tmp/proj/src/app.py');
        expect(joinProjectPath('/tmp/proj/', 'README.md')).toBe('/tmp/proj/README.md');
        expect(joinProjectPath('/tmp/proj', '/abs/already')).toBe('/abs/already'); // absolute unchanged
        expect(joinProjectPath(undefined, 'README.md')).toBe('README.md'); // no base → unchanged
    });

    it('reads projectPath from a tool input, treating any weird value as absent', () => {
        expect(inputProjectPath({projectPath: '/tmp/proj', file_path: 'a'})).toBe('/tmp/proj');
        expect(inputProjectPath({file_path: 'a'})).toBeUndefined();
        expect(inputProjectPath(undefined)).toBeUndefined();
        // generic guards (not a special-case for the literal string "null"):
        expect(inputProjectPath({projectPath: null})).toBeUndefined();      // real null
        expect(inputProjectPath({projectPath: 42})).toBeUndefined();        // wrong type
        expect(inputProjectPath({projectPath: '   '})).toBeUndefined();     // blank
    });

    it('uses the v3 (renamed) titles', () => {
        expect(toolTitle('mcp__idea__get_all_open_file_paths')).toBe('Get all open file paths');
        expect(toolTitle('mcp__idea__get_project_modules')).toBe('Get project modules');
        expect(toolTitle('mcp__idea__get_run_configurations')).toBe('Get run configurations');
        expect(toolTitle('mcp__idea__xdebug_get_frame_values')).toBe('Debugger: get frame values');
        expect(toolTitle('mcp__idea__xdebug_get_value_by_path')).toBe('Debugger: inspect value');
    });

    it('splits the directory portion of a path', () => {
        expect(dirname('src/main/App.java')).toBe('src/main/');
        expect(dirname('App.java')).toBe('');
        expect(dirname('a/b/')).toBe('a/');
    });

    it('classifies runtime value types', () => {
        expect(valueType('x')).toBe('string');
        expect(valueType(1)).toBe('number');
        expect(valueType(true)).toBe('boolean');
        expect(valueType(['a', 'b'])).toBe('string[]');
        expect(valueType([1, 2])).toBe('array');
        expect(valueType({})).toBe('object');
        expect(valueType(null)).toBe('null');
    });

    it('flags type mismatches but treats absent values as fine', () => {
        expect(typeMismatch('x', 'string')).toBe(false);
        expect(typeMismatch(1, 'string')).toBe(true);
        expect(typeMismatch(['a'], 'string[]')).toBe(false);
        expect(typeMismatch('a', 'string[]')).toBe(true);
        expect(typeMismatch(null, 'string')).toBe(false); // not provided → not a red flag
        expect(typeMismatch(undefined, 'number')).toBe(false);
    });

    it('detects payload-level failures (no is_error flag needed)', () => {
        expect(resultIndicatesError('{"isSuccess":false,"problems":[]}')).toBe(true);
        expect(resultIndicatesError('{"isSuccess":true,"problems":[]}')).toBe(false);
        expect(resultIndicatesError('{"command_exit_code":1}')).toBe(true);
        expect(resultIndicatesError('{"command_exit_code":0}')).toBe(false);
        expect(resultIndicatesError('{"exitCode":2}')).toBe(true);
        expect(resultIndicatesError('{"applied":false}')).toBe(true);
        expect(resultIndicatesError('{"removed":false}')).toBe(true);
        // status strings are NOT failures (avoids false reds), nor is plain text
        expect(resultIndicatesError('{"status":"stopped"}')).toBe(false);
        expect(resultIndicatesError('just text')).toBe(false);
    });

    it('extracts a compact debugger outcome (or null when nothing structured)', () => {
        expect(debuggerOutcome('{"status":"stopped"}')).toMatchObject({status: 'stopped'});
        expect(debuggerOutcome('{"path":["sum"],"oldValue":"0","newValue":"100","applied":true}'))
            .toMatchObject({oldValue: '0', newValue: '100', applied: true});
        expect(debuggerOutcome('{"removed":true,"message":"Removed 1 breakpoint(s)."}'))
            .toMatchObject({message: 'Removed 1 breakpoint(s).'});
        expect(debuggerOutcome('"World"')).toBeNull();      // not an object
        expect(debuggerOutcome('{"frames":[]}')).toBeNull(); // nothing human-meaningful
    });

    it('flags a debugger result that carries content beyond the compact outcome', () => {
        // extra key (e.g. DRAIN_EVENTS' drained events) → must be shown in full
        expect(debuggerHasExtraPayload('{"status":"paused","tracepointOutputsTail":["a"]}')).toBe(true);
        // only recognized + echoed request/structural fields → compact row is enough
        expect(debuggerHasExtraPayload('{"status":"running"}')).toBe(false);
        expect(debuggerHasExtraPayload('{"path":["sum"],"oldValue":"0","newValue":"100","applied":true}')).toBe(false);
        expect(debuggerHasExtraPayload('{"removed":true,"message":"Removed 1 breakpoint(s)."}')).toBe(false);
        // non-object payloads carry no hidden keys
        expect(debuggerHasExtraPayload('"World"')).toBe(false);
    });
});
