/**
 * Shared helpers for the JetBrains IDE MCP tool renderers.
 *
 * The built-in MCP server shipped by JetBrains IDEs (2025.2+) auto-registers in
 * Claude Code under the IDE's launcher name — `idea` for IntelliJ IDEA,
 * `pycharm` for PyCharm, etc. — so a tool call arrives as `mcp__<launcher>__<tool>`.
 * These helpers map the launcher segment to a product display name and the tool
 * suffix to a human action title (both reused by the permission dialog), and
 * parse the JSON result payloads the IDE tools return.
 */

import type {McpToolNamer} from "../../_common";

const MCP_PREFIX = 'mcp__';

/**
 * Launcher/server name → product display name. Covers the JetBrains IDEs that
 * ship the built-in MCP server (best-effort for the less common ones).
 */
export const JETBRAINS_SERVERS: Record<string, string> = {
    idea: 'IntelliJ IDEA',
    pycharm: 'PyCharm',
    webstorm: 'WebStorm',
    phpstorm: 'PhpStorm',
    goland: 'GoLand',
    clion: 'CLion',
    rider: 'Rider',
    rubymine: 'RubyMine',
    datagrip: 'DataGrip',
    dataspell: 'DataSpell',
    rustrover: 'RustRover',
    aqua: 'Aqua',
    mps: 'MPS',
    writerside: 'Writerside',
    studio: 'Android Studio',
};

function sentenceCase(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The `<server>` segment of `mcp__<server>__<tool>` ('' if not an mcp name). */
export function mcpServerSegment(name: string): string {
    if (!name || !name.startsWith(MCP_PREFIX)) return '';
    return name.slice(MCP_PREFIX.length).split('__')[0] ?? '';
}

/** Tool suffix after `mcp__<server>__` (re-joined so `__` inside the tool survives). */
export function jetbrainsToolSuffix(name: string): string {
    if (!name || !name.startsWith(MCP_PREFIX)) return name ?? '';
    return name.slice(MCP_PREFIX.length).split('__').slice(1).join('__');
}

/** True when `name` is `mcp__<jetbrains-launcher>__<tool>`. */
export function isJetBrainsTool(name: string): boolean {
    return !!JETBRAINS_SERVERS[mcpServerSegment(name)];
}

/** Product display name for a JetBrains tool (fallback: title-cased server segment). */
export function jetbrainsProductName(name: string): string {
    const server = mcpServerSegment(name);
    return JETBRAINS_SERVERS[server] ?? sentenceCase(server.replace(/_/g, ' '));
}

/** Human action title per tool suffix; everything else falls back to a prettified suffix. */
export const TOOL_TITLES: Record<string, string> = {
    // Files / editor
    open_file_in_editor: 'Open file',
    get_all_open_file_paths: 'Get all open file paths',
    read_file: 'Read file',
    create_new_file: 'Create new file',
    search_file: 'Search files',
    list_directory_tree: 'List files',
    reformat_file: 'Reformat',
    apply_patch: 'Apply patch',
    // Code / symbols
    get_symbol_info: 'Symbol info',
    search_symbol: 'Find symbol',
    analyze_calls: 'Call hierarchy',
    rename_refactoring: 'Rename symbol',
    search_text: 'Search in files',
    search_regex: 'Search in files (regex)',
    generate_psi_tree: 'PSI tree',
    find_threading_requirements_usages: 'Threading usages',
    find_lock_requirements_usages: 'Lock usages',
    // Inspections
    get_file_problems: 'Inspect file',
    lint_files: 'Lint files',
    run_inspection_kts: 'Run inspection',
    generate_inspection_kts_api: 'Inspection API',
    generate_inspection_kts_examples: 'Inspection examples',
    // Run / Debug — the debugger family shares a "Debugger: …" prefix so the
    // grouped operations read consistently in both the card and the dialog.
    get_run_configurations: 'Get run configurations',
    execute_run_configuration: 'Run',
    xdebug_start_debugger_session: 'Debugger: start session',
    xdebug_get_debugger_status: 'Debugger: get status',
    xdebug_get_stack: 'Debugger: get stack frames',
    xdebug_get_threads: 'Debugger: get threads',
    xdebug_get_frame_values: 'Debugger: get frame values',
    xdebug_get_value_by_path: 'Debugger: inspect value',
    xdebug_evaluate_expression: 'Debugger: evaluate expression',
    xdebug_set_breakpoint: 'Debugger: set breakpoint',
    xdebug_remove_breakpoint: 'Debugger: remove breakpoint',
    xdebug_list_breakpoints: 'Debugger: list breakpoints',
    xdebug_control_session: 'Debugger: control session',
    xdebug_run_to_line: 'Debugger: run to line',
    xdebug_set_variable: 'Debugger: set variable',
    // Build / project
    build_project: 'Build project',
    get_project_modules: 'Get project modules',
    get_project_dependencies: 'Get project dependencies',
    create_ij_module: 'Create module',
    recognize_ij_module_kind: 'Module kind',
    // Terminal / VCS
    execute_terminal_command: 'Run command',
    git_status: 'Git status',
    get_repositories: 'Repositories',
    // Database
    create_database_connection: 'Add DB connection',
    edit_database_connection: 'Edit DB connection',
    list_database_connections: 'DB connections',
    list_database_schemas: 'DB schemas',
    test_database_connection: 'Test DB connection',
    get_database_object_description: 'DB object',
    execute_sql_query: 'Run SQL',
    cancel_sql_query: 'Cancel SQL',
    fetch_query_result: 'SQL result',
    list_recent_sql_queries: 'Recent SQL',
    introspect_schema: 'Introspect schema',
    list_schema_object_kinds: 'Schema object kinds',
    list_schema_objects: 'Schema objects',
    preview_table_data: 'Preview table',
    // Misc
    execute_tool: 'Run tool',
};

/** Human action title for a (full) tool name; fallback prettifies the suffix. */
export function toolTitle(name: string): string {
    const suffix = jetbrainsToolSuffix(name);
    return TOOL_TITLES[suffix] ?? sentenceCase(suffix.replace(/_/g, ' '));
}

/**
 * This family's naming contract for the MCP humanizer registry (see
 * `Mcp/humanize.ts`). Kept here beside the JetBrains name maps so general chat UI
 * never imports JetBrains internals directly — it goes through the aggregator.
 */
export const jetBrainsToolNamer: McpToolNamer = {
    matches: isJetBrainsTool,
    label: (name) => `${jetbrainsProductName(name)}: ${toolTitle(name)}`,
    sessionScopeLabel: (name) => `"${toolTitle(name)}"`,
};

/** Full catalog of JetBrains MCP tool suffixes (identical across IDEs). */
export const JETBRAINS_TOOLS: string[] = [
    // Files / editor
    'open_file_in_editor', 'get_all_open_file_paths', 'read_file', 'create_new_file',
    'search_file', 'list_directory_tree', 'reformat_file', 'apply_patch',
    // Code / symbols
    'get_symbol_info', 'search_symbol', 'analyze_calls', 'rename_refactoring',
    'search_text', 'search_regex', 'generate_psi_tree',
    'find_threading_requirements_usages', 'find_lock_requirements_usages',
    // Inspections
    'get_file_problems', 'lint_files', 'run_inspection_kts',
    'generate_inspection_kts_api', 'generate_inspection_kts_examples',
    // Run / Debug
    'get_run_configurations', 'execute_run_configuration',
    'xdebug_start_debugger_session', 'xdebug_get_debugger_status', 'xdebug_get_stack',
    'xdebug_get_threads', 'xdebug_get_frame_values', 'xdebug_get_value_by_path',
    'xdebug_evaluate_expression', 'xdebug_set_breakpoint', 'xdebug_remove_breakpoint',
    'xdebug_list_breakpoints', 'xdebug_control_session', 'xdebug_run_to_line', 'xdebug_set_variable',
    // Build / project
    'build_project', 'get_project_modules', 'get_project_dependencies',
    'create_ij_module', 'recognize_ij_module_kind',
    // Terminal
    'execute_terminal_command',
    // Git / VCS
    'git_status', 'get_repositories',
    // Database
    'create_database_connection', 'edit_database_connection', 'list_database_connections',
    'list_database_schemas', 'test_database_connection', 'get_database_object_description',
    'execute_sql_query', 'cancel_sql_query', 'fetch_query_result', 'list_recent_sql_queries',
    'introspect_schema', 'list_schema_object_kinds', 'list_schema_objects', 'preview_table_data',
    // Misc
    'execute_tool',
];

/**
 * Coerce an untrusted value into an array. Result payloads are typed via each
 * renderer's DTO, but the runtime value is untrusted (a model slip or a future
 * MCP schema change could send a non-array where an array is declared), so any
 * `.map`/`.length` on such a field must go through this guard. Returns `[]` for
 * anything that isn't an array — never throws.
 */
export function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Like {@link asArray} but also drops elements that aren't plain objects (null,
 * strings, numbers). `asArray` only guards the container; a renderer that reads
 * `it.someField` on each element still throws if an element is `null` or a
 * primitive (a model slip / future schema change can send `[null]`), so any
 * per-element property access must go through this. Never throws.
 */
export function asObjects<T extends object>(value: unknown): T[] {
    return asArray<unknown>(value).filter(
        (it): it is T => typeof it === 'object' && it !== null && !Array.isArray(it),
    );
}

/** Like {@link asArray} but keeps only string elements. Never throws. */
export function asStrings(value: unknown): string[] {
    return asArray<unknown>(value).filter((it): it is string => typeof it === 'string');
}

/** Parse a JSON string, returning undefined on any failure. Never throws. */
export function safeParseJson<T>(text: string): T | undefined {
    if (!text) return undefined;
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
}

/** True for "no meaningful output" payloads already conveyed by the status dot. */
export function isTrivialResult(text: string): boolean {
    const t = (text ?? '').trim().toLowerCase();
    return t === '' || t === 'ok' || t === 'done' || t === 'success' || t === '[success]'
        || t === '{}' || t === '[]';
}

/** Pretty-print JSON output; returns the raw text unchanged when it is not JSON. */
export function prettyResult(text: string): string {
    const parsed = safeParseJson<unknown>(text);
    return parsed !== undefined ? JSON.stringify(parsed, null, 2) : text;
}

/**
 * Final segment of a path (like the unix `basename` command); '' for a non-string.
 * Splits on both `/` and `\` so a Windows-style path (cmd/PowerShell/WSL are all
 * supported targets) doesn't collapse into a single unsplit segment.
 */
export function basename(path: string): string {
    const s = typeof path === 'string' ? path : '';
    const parts = s.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : s;
}

/**
 * Resolve a project-relative path against `projectPath` so the IDE/OS opens the
 * file in the correct project. IDE tool paths are relative to the tool's
 * `projectPath`; the backend would otherwise resolve them against its own cwd
 * (wrong project). Already-absolute paths are returned unchanged.
 */
export function joinProjectPath(projectPath: string | undefined, p: string): string {
    if (typeof p !== 'string' || !p) return '';
    if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return p; // already absolute (POSIX or Windows)
    if (typeof projectPath !== 'string' || !projectPath) return p;
    return `${projectPath.replace(/[\\/]+$/, '')}/${p}`;
}

/**
 * Read the `projectPath` field from a tool input (IDE paths are relative to it).
 * Anything that isn't a non-empty string — missing, real `null`, a number, an
 * empty/whitespace value — is treated as "not specified" and returns undefined,
 * so a malformed input can never leak into a resolved path.
 */
export function inputProjectPath(input: unknown): string | undefined {
    if (input && typeof input === 'object' && 'projectPath' in input) {
        const v = (input as Record<string, unknown>).projectPath;
        return typeof v === 'string' && v.trim() ? v : undefined;
    }
    return undefined;
}

/**
 * Directory portion of a path including the trailing separator ('' when none /
 * non-string). Handles both `/` and `\` separators (Windows paths included).
 */
export function dirname(path: string): string {
    const norm = (typeof path === 'string' ? path : '').replace(/[\\/]+$/, '');
    const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'));
    return idx < 0 ? '' : norm.slice(0, idx + 1);
}

/** A coarse runtime type, used to flag inputs whose type doesn't match the schema. */
export type ParamType = 'string' | 'number' | 'boolean' | 'string[]' | 'object';

/** Runtime type of value in the same vocabulary as {@link ParamType} (or 'other'). */
export function valueType(v: unknown): ParamType | 'array' | 'null' | 'other' {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) return v.every((e) => typeof e === 'string') ? 'string[]' : 'array';
    if (typeof v === 'object') return 'object';
    return 'other';
}

/**
 * True when `value` is present but does not match the schema-declared `expected`
 * type. Absent values (null/undefined) are treated as "not provided" and never
 * flagged — only a present, wrongly-typed value is a red flag worth surfacing.
 */
export function typeMismatch(value: unknown, expected: ParamType): boolean {
    if (value === null || value === undefined) return false;
    return valueType(value) !== expected;
}

/**
 * True when a tool's JSON result payload denotes failure even though the
 * tool_result block isn't flagged `is_error` — e.g. a build that didn't compile
 * (`isSuccess:false`), a command with a non-zero exit code, or a debugger
 * mutation that wasn't applied/removed. Status strings (`"stopped"`/`"timeout"`)
 * are deliberately NOT treated as errors to avoid false reds.
 */
export function resultIndicatesError(out: string): boolean {
    const p = safeParseJson<Record<string, unknown>>(out);
    if (!p || typeof p !== 'object') return false;
    if (p.isSuccess === false) return true;
    if (typeof p.command_exit_code === 'number' && p.command_exit_code !== 0) return true;
    if (typeof p.exitCode === 'number' && p.exitCode !== 0) return true;
    if (p.applied === false) return true;
    if (p.removed === false) return true;
    return false;
}

export interface DebuggerOutcome {
    status?: string;            // paused | running | stopped | timeout
    message?: string;           // human message, e.g. "Removed 1 breakpoint(s)."
    oldValue?: string;
    newValue?: string;
    applied?: boolean;
}

/**
 * Extract the few human-meaningful fields from a debugger result so the card can
 * show a compact outcome instead of raw JSON. Returns null when nothing
 * structured is present (the renderer then falls back to a small JSON box).
 */
export function debuggerOutcome(out: string): DebuggerOutcome | null {
    const p = safeParseJson<Record<string, unknown>>(out);
    if (!p || typeof p !== 'object') return null;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const outcome: DebuggerOutcome = {
        status: str(p.status),
        message: str(p.message),
        oldValue: p.oldValue !== undefined ? String(p.oldValue) : undefined,
        newValue: p.newValue !== undefined ? String(p.newValue) : undefined,
        applied: typeof p.applied === 'boolean' ? p.applied : undefined,
    };
    const hasAny = outcome.status || outcome.message
        || outcome.oldValue !== undefined || outcome.newValue !== undefined
        || outcome.applied !== undefined;
    return hasAny ? outcome : null;
}

/** Fields the compact DebuggerOutcomeRow already surfaces. */
const DEBUGGER_OUTCOME_KEYS = new Set(['status', 'message', 'oldValue', 'newValue', 'applied']);
/** Request echoes / structural ids in a result that carry no extra output. */
const DEBUGGER_ECHO_KEYS = new Set([
    'removed', 'path', 'id', 'breakpointId', 'sessionId', 'threadId', 'threadName',
    'frameIndex', 'line', 'filePath', 'name',
]);

/**
 * True when a debugger result carries content BEYOND the compact outcome and
 * echoed request/structural fields — e.g. the buffered events `DRAIN_EVENTS`
 * returns (its input even takes `eventsLimit` / `clearEventsAfterRead`). Such
 * content must be shown in full (raw JSON) instead of being collapsed into the
 * status-only summary, so nothing meaningful is hidden. Name-agnostic: any
 * unrecognized key counts, so we don't have to hard-code the payload's shape.
 */
export function debuggerHasExtraPayload(out: string): boolean {
    const p = safeParseJson<Record<string, unknown>>(out);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    return Object.keys(p).some((k) => !DEBUGGER_OUTCOME_KEYS.has(k) && !DEBUGGER_ECHO_KEYS.has(k));
}
