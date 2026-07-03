/**
 * Single source of truth for JetBrains MCP tool input parameters.
 *
 * The values here are taken from the **live tool schemas** exposed by the IDE's
 * built-in MCP server (which differ in places from the public docs page — e.g.
 * `reformat_file` takes `files: string[]`, not `path`). Centralizing the field
 * names is the anti-bug measure: renderers read `spec.fileParam` /
 * `spec.segmentsParam` etc. instead of guessing input keys, so a binding can
 * only be wrong in one place.
 *
 * `known` lists EVERY parameter of a tool with its expected type. It drives the
 * security-critical "unrecognized input" notice: any input key not in `known`
 * (other than `projectPath`, which is always handled via the path display), or
 * any known key whose runtime type differs from the schema, is surfaced to the
 * user so nothing can be smuggled past approval.
 */

import {jetbrainsToolSuffix, typeMismatch, type ParamType} from './helpers';

export interface ToolSpec {
    /** Single project-relative file path → header link. */
    fileParam?: string;
    /** `string[]` of project-relative files → file list. */
    filesParam?: string;
    /** Directory path → header link. */
    dirParam?: string;
    /** Search term key (`q`). */
    queryParam?: string;
    /** Connector word shown before the query (e.g. "pattern", "text", "regex"). */
    queryWord?: string;
    /** `string[]` of glob path filters that scope a search (`paths`). */
    scopeParam?: string;
    /** `string[]` value-navigation path (xdebug inspect/set). */
    segmentsParam?: string;
    /** Shell command → IN block. */
    commandParam?: string;
    /** Debugger expression → IN block. */
    exprParam?: string;
    /** New value assigned by `xdebug_set_variable`. */
    newValueParam?: string;
    /** Enum action whose value becomes part of the title (control_session). */
    actionParam?: string;
    /** Line number key (for 1-based line / column location) appended to the header link. */
    lineParam?: string;
    /** Column number key (for 1-based line / column location) appended to the header link. */
    columnParam?: string;
    /** Existing run configuration name. */
    configParam?: string;
    /**
     * Execution-affecting params that must ALWAYS be shown to the user before
     * approval even though they're in `known` (so `surprisingFields` won't flag
     * them) and aren't otherwise rendered — e.g. program arguments, working
     * directory, environment variables. Omitting these would let a run be
     * launched with args/env the approval never revealed.
     */
    sensitiveParams?: string[];
    /** Every schema parameter with its declared type (excludes `projectPath`). */
    known: Record<string, ParamType>;
}

const FILE = 'string' as const;

export const TOOL_SPECS: Record<string, ToolSpec> = {
    // ── Files / editor ───────────────────────────────────────────────────────
    create_new_file: {
        fileParam: 'pathInProject',
        known: {pathInProject: FILE, text: 'string', overwrite: 'boolean'},
    },
    read_file: {
        fileParam: 'file_path',
        known: {file_path: FILE, offset: 'number', limit: 'number'},
    },
    open_file_in_editor: {
        fileParam: 'filePath',
        known: {filePath: FILE},
    },
    reformat_file: {
        filesParam: 'files',
        known: {files: 'string[]'},
    },
    list_directory_tree: {
        dirParam: 'directoryPath',
        known: {directoryPath: FILE, maxDepth: 'number', timeout: 'number'},
    },
    rename_refactoring: {
        fileParam: 'pathInProject',
        known: {pathInProject: FILE, symbolName: 'string', newName: 'string'},
    },
    // ── Inspections ────────────────────────────────────────────────────────────
    get_file_problems: {
        fileParam: 'filePath',
        known: {filePath: FILE, errorsOnly: 'boolean', timeout: 'number'},
    },
    lint_files: {
        filesParam: 'files',
        known: {files: 'string[]', min_severity: 'string', timeout: 'number'},
    },
    get_symbol_info: {
        fileParam: 'filePath',
        lineParam: 'line',
        columnParam: 'column',
        known: {filePath: FILE, line: 'number', column: 'number'},
    },
    // ── Search ───────────────────────────────────────────────────────────────
    search_file: {
        queryParam: 'q',
        queryWord: 'pattern',
        scopeParam: 'paths',
        known: {q: 'string', paths: 'string[]', includeExcluded: 'boolean', limit: 'number'},
    },
    search_text: {
        queryParam: 'q',
        queryWord: 'text',
        scopeParam: 'paths',
        known: {q: 'string', paths: 'string[]', limit: 'number'},
    },
    search_regex: {
        queryParam: 'q',
        queryWord: 'regex',
        scopeParam: 'paths',
        known: {q: 'string', paths: 'string[]', limit: 'number'},
    },
    search_symbol: {
        queryParam: 'q',
        queryWord: 'symbol',
        scopeParam: 'paths',
        known: {q: 'string', paths: 'string[]', include_external: 'boolean', limit: 'number'},
    },
    // ── Terminal / run ─────────────────────────────────────────────────────────
    execute_terminal_command: {
        commandParam: 'command',
        known: {
            command: 'string', executeInShell: 'boolean', reuseExistingTerminalWindow: 'boolean',
            maxLinesCount: 'number', truncateMode: 'string', timeout: 'number',
        },
    },
    execute_run_configuration: {
        fileParam: 'filePath',
        lineParam: 'line',
        configParam: 'configurationName',
        sensitiveParams: ['programArguments', 'workingDirectory', 'envs'],
        known: {
            configurationName: 'string', filePath: FILE, line: 'number', timeout: 'number',
            waitForExit: 'boolean', programArguments: 'string', workingDirectory: 'string', envs: 'object',
        },
    },
    get_run_configurations: {
        fileParam: 'filePath',
        known: {filePath: FILE},
    },
    // ── Git / project ──────────────────────────────────────────────────────────
    git_status: {
        known: {
            includeIgnored: 'boolean', includeUntracked: 'boolean', limit: 'number',
            repositoryPathRelativeToProject: 'string',
        },
    },
    get_repositories: {known: {}},
    get_project_modules: {known: {}},
    get_project_dependencies: {known: {}},
    build_project: {
        filesParam: 'filesToRebuild',
        known: {rebuild: 'boolean', filesToRebuild: 'string[]', timeout: 'number'},
    },
    apply_patch: {
        known: {input: 'string', patch: 'string'},
    },
    // ── Debugger ─────────────────────────────────────────────────────────────
    xdebug_start_debugger_session: {
        fileParam: 'filePath',
        lineParam: 'line',
        configParam: 'configurationName',
        sensitiveParams: ['programArguments', 'workingDirectory', 'envs'],
        known: {
            configurationName: 'string', filePath: FILE, line: 'number', timeout: 'number',
            graceWaitMs: 'number', programArguments: 'string', workingDirectory: 'string', envs: 'object',
        },
    },
    xdebug_control_session: {
        actionParam: 'action',
        known: {
            action: 'string', sessionId: 'string', timeout: 'number',
            eventsLimit: 'number', clearEventsAfterRead: 'boolean',
        },
    },
    xdebug_get_debugger_status: {known: {}},
    xdebug_get_threads: {
        known: {sessionId: 'string', limit: 'number', offset: 'number'},
    },
    xdebug_get_stack: {
        known: {sessionId: 'string', threadId: 'string', limit: 'number', offset: 'number'},
    },
    xdebug_get_frame_values: {
        known: {sessionId: 'string', frameIndex: 'number', depth: 'number'},
    },
    xdebug_get_value_by_path: {
        segmentsParam: 'path',
        known: {sessionId: 'string', frameIndex: 'number', path: 'string[]', depth: 'number'},
    },
    xdebug_evaluate_expression: {
        exprParam: 'expression',
        known: {sessionId: 'string', frameIndex: 'number', expression: 'string', depth: 'number'},
    },
    xdebug_set_variable: {
        segmentsParam: 'path',
        newValueParam: 'newValue',
        known: {sessionId: 'string', frameIndex: 'number', path: 'string[]', newValue: 'string'},
    },
    xdebug_run_to_line: {
        fileParam: 'filePath',
        lineParam: 'line',
        known: {sessionId: 'string', filePath: FILE, line: 'number', timeout: 'number'},
    },
    xdebug_set_breakpoint: {
        fileParam: 'filePath',
        lineParam: 'line',
        known: {
            breakpointId: 'string', filePath: FILE, line: 'number', condition: 'string',
            isLogMessage: 'boolean', isLogStack: 'boolean', logExpression: 'string', temporary: 'boolean',
            suspendPolicy: 'string', enabled: 'boolean', breakpointsMuted: 'boolean', sessionId: 'string',
        },
    },
    xdebug_remove_breakpoint: {
        fileParam: 'filePath',
        lineParam: 'line',
        known: {breakpointId: 'string', filePath: FILE, line: 'number', owner: 'string', sessionId: 'string'},
    },
    xdebug_list_breakpoints: {
        fileParam: 'filePath',
        known: {filePath: FILE, sessionId: 'string'},
    },
};

/** Spec for a (full) tool name, or undefined for the unmodeled long tail. */
export function getToolSpec(toolName: string): ToolSpec | undefined {
    return TOOL_SPECS[jetbrainsToolSuffix(toolName)];
}

/**
 * The single header file/dir path for a tool, resolved from its spec (never a
 * hand-typed key guess). Returns the raw project-relative path string.
 */
export function headerFilePath(toolName: string, input: Record<string, unknown>): string | undefined {
    const spec = getToolSpec(toolName);
    const key = spec?.fileParam ?? spec?.dirParam;
    if (!key) return undefined;
    const v = input[key];
    return typeof v === 'string' && v ? v : undefined;
}

export interface SurprisingField {
    key: string;
    value: unknown;
    /** 'unknown' = key not in the schema; 'type' = present but wrongly typed. */
    reason: 'unknown' | 'type';
}

/**
 * Input fields that should be flagged to the user before approval: keys absent
 * from the tool's schema, or known keys whose runtime type is wrong. Returns []
 * for unmodeled tools (the generic renderer dumps their full input instead) and
 * never flags `projectPath` (always conveyed by the path display).
 */
export interface DisclosedField {
    key: string;
    value: unknown;
}

/**
 * Present execution-affecting fields (a tool's {@link ToolSpec.sensitiveParams})
 * that must always be shown before approval. Only keys actually provided in the
 * input are returned; `[]` for tools without sensitive params or a clean input.
 */
export function sensitiveFields(toolName: string, input: Record<string, unknown>): DisclosedField[] {
    const spec = getToolSpec(toolName);
    if (!spec?.sensitiveParams) return [];
    const out: DisclosedField[] = [];
    for (const key of spec.sensitiveParams) {
        const value = input[key];
        if (value !== undefined && value !== null) out.push({key, value});
    }
    return out;
}

export function surprisingFields(toolName: string, input: Record<string, unknown>): SurprisingField[] {
    const spec = getToolSpec(toolName);
    if (!spec) return [];
    const out: SurprisingField[] = [];
    for (const [key, value] of Object.entries(input)) {
        if (key === 'projectPath') continue;
        const expected = spec.known[key];
        if (expected === undefined) out.push({key, value, reason: 'unknown'});
        else if (typeMismatch(value, expected)) out.push({key, value, reason: 'type'});
    }
    return out;
}
