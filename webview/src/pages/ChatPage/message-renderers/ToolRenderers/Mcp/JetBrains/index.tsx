import {FC} from "react";
import {RendererProps} from "../../common";
import {JETBRAINS_SERVERS, JETBRAINS_TOOLS} from "./_shared";
import {JetBrainsGenericRenderer} from "./JetBrainsGenericRenderer";
import {JetBrainsActionRenderer} from "./JetBrainsActionRenderer";
import {ReadFileRenderer} from "./ReadFileRenderer";
import {CreateNewFileRenderer} from "./CreateNewFileRenderer";
import {ListDirectoryTreeRenderer} from "./ListDirectoryTreeRenderer";
import {SearchFileRenderer} from "./SearchFileRenderer";
import {SearchTextRenderer} from "./SearchTextRenderer";
import {ReplaceTextRenderer} from "./ReplaceTextRenderer";
import {ProblemsRenderer} from "./ProblemsRenderer";
import {GitStatusRenderer} from "./GitStatusRenderer";
import {ExecuteTerminalCommandRenderer} from "./ExecuteTerminalCommandRenderer";
import {DebuggerEvalRenderer} from "./DebuggerEvalRenderer";
import {BreakpointRenderer} from "./BreakpointRenderer";
import {GetRunConfigurationsRenderer} from "./GetRunConfigurationsRenderer";
import {ExecuteRunConfigurationRenderer} from "./ExecuteRunConfigurationRenderer";
import {OpenFilesRenderer} from "./OpenFilesRenderer";
import {ProjectListRenderer} from "./ProjectListRenderer";

/**
 * Tools with a dedicated renderer (keyed by tool suffix). Everything else falls
 * back to `JetBrainsGenericRenderer`. The same map applies to every JetBrains
 * IDE because the tool set is identical across them.
 */
const RICH: Record<string, FC<RendererProps>> = {
    // Files / editor
    read_file: ReadFileRenderer,
    get_file_text_by_path: ReadFileRenderer,
    create_new_file: CreateNewFileRenderer,
    replace_text_in_file: ReplaceTextRenderer,
    list_directory_tree: ListDirectoryTreeRenderer,
    search_file: SearchFileRenderer,
    find_files_by_glob: SearchFileRenderer,
    find_files_by_name_keyword: SearchFileRenderer,
    open_file_in_editor: JetBrainsActionRenderer,
    reformat_file: JetBrainsActionRenderer,
    apply_patch: JetBrainsActionRenderer,
    get_all_open_file_paths: OpenFilesRenderer,
    // Code / symbols
    rename_refactoring: JetBrainsActionRenderer,
    search_text: SearchTextRenderer,
    search_regex: SearchTextRenderer,
    search_in_files_by_text: SearchTextRenderer,
    search_in_files_by_regex: SearchTextRenderer,
    // Inspections
    get_file_problems: ProblemsRenderer,
    lint_files: ProblemsRenderer,
    build_project: ProblemsRenderer,
    // Run / Debug
    get_run_configurations: GetRunConfigurationsRenderer,
    execute_run_configuration: ExecuteRunConfigurationRenderer,
    xdebug_start_debugger_session: JetBrainsActionRenderer,
    xdebug_set_breakpoint: BreakpointRenderer,
    xdebug_remove_breakpoint: BreakpointRenderer,
    xdebug_control_session: JetBrainsActionRenderer,
    xdebug_run_to_line: JetBrainsActionRenderer,
    xdebug_set_variable: JetBrainsActionRenderer,
    xdebug_get_value_by_path: JetBrainsActionRenderer,
    xdebug_evaluate_expression: DebuggerEvalRenderer,
    // Build / project
    get_project_modules: ProjectListRenderer,
    get_project_dependencies: ProjectListRenderer,
    // Terminal / VCS
    execute_terminal_command: ExecuteTerminalCommandRenderer,
    git_status: GitStatusRenderer,
};

/**
 * One registry entry per (JetBrains IDE server name × tool). The IDE's built-in
 * MCP server registers under its launcher name (`idea`, `pycharm`, …), so the
 * same renderers are bound for every supported IDE.
 */
export const JetBrainsRenderers: Array<[string, FC<RendererProps>]> = Object.keys(JETBRAINS_SERVERS).flatMap(
    (server) =>
        JETBRAINS_TOOLS.map(
            (tool): [string, FC<RendererProps>] => [`mcp__${server}__${tool}`, RICH[tool] ?? JetBrainsGenericRenderer]
        )
);
