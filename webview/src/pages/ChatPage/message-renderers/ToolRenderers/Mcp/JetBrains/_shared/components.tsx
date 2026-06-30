import {ReactNode} from "react";
import {getAdapter} from "@/adapters";
import {Tooltip} from "@/components";
import {cn} from "@/utils/cn";
import type {LoadedMessageDto} from "@/types";
import {parseUserDeclined} from "@/shared";
import {useWorkingDirOrNull} from "@/contexts/WorkingDirContext";
import {
    Container, LabelValue, ToolHeader, useToolStatus, useCurrentToolUse, toolResultIsError, toolResultText,
} from "../../../common";
import {basename, dirname, jetbrainsProductName, toolTitle, joinProjectPath, inputProjectPath, type DebuggerOutcome} from "./helpers";
import {surprisingFields} from "./tool-params";

const ROOT_PATHS = new Set(['', '.', './']);
/** True for the project-root reference ('' / '.' / './'); false for a non-string. */
function isProjectRoot(path: string): boolean {
    return ROOT_PATHS.has((typeof path === 'string' ? path : '').trim());
}

/**
 * Header shaped exactly like the native tool cards (e.g. Bash): the bold
 * product name (IntelliJ IDEA / PyCharm / …) followed by a dim human action
 * description and an optional clickable file link styled like native `Read`.
 */
export const JetBrainsToolHeader = (props: {
    name: string;
    action?: string;
    path?: string;
    pathLabel?: string;
    projectPath?: string;
    /** Gate the link until success — only for targets that don't exist yet (create). */
    gateOnCreate?: boolean;
    extra?: ReactNode;
    /**
     * The tool input. When passed, the header renders the security notice for any
     * unrecognized / wrongly-typed field directly beneath itself (the right place
     * for it — never buried below the body).
     */
    input?: Record<string, unknown>;
}) => {
    const {name, action, path, pathLabel, projectPath, gateOnCreate, extra, input} = props;
    const product = jetbrainsProductName(name);
    const title = action ?? toolTitle(name);
    // A non-string path (a model slip / future schema change) must not reach the
    // path helpers or render a broken link — treat it as "no path".
    const safePath = typeof path === 'string' ? path : undefined;

    // Hover tooltip on the product name shows the raw MCP tool id (e.g.
    // `mcp__idea__create_new_file`) — the exact name a CLI user would see, useful
    // for debugging/reports. The IDE never sends richer display metadata (no
    // `tool_use_meta`), so there's nothing else to surface here.
    return (
        <>
            <ToolHeader name={product} nameTooltip={name}>
                <div className="flex items-center gap-1.5 text-text-primary/60 text-[0.9230rem] min-w-0">
                    <span className="shrink-0">{title}</span>
                    {safePath && (
                        <JetBrainsFileLink
                            path={safePath}
                            label={pathLabel}
                            projectPath={projectPath}
                            gateOnCreate={gateOnCreate}
                        />
                    )}
                    {extra}
                </div>
            </ToolHeader>
            <ProjectPathChip />
            {input && <UnrecognizedInputNotice toolName={name} input={input} />}
        </>
    );
};

/**
 * Clickable file path that opens in the IDE. The displayed text is the basename
 * with a dimmed parent directory (so the full relative location is visible); the
 * resolved absolute path is the hover `title`. The path opened is resolved
 * against `projectPath` so it targets the correct project.
 *
 * Links are clickable immediately — even before approval — because the file
 * almost always already exists (Read/Reformat/Inspect/…). The sole exception is
 * `create_new_file` (and apply_patch "Add" hunks): pass `gateOnCreate` so the
 * link stays plain text until the call succeeds and the file exists.
 */
/**
 * The project-root reference, shown consistently as a clickable "project root"
 * (never a bare ".") that opens the project directory. Used for tools targeting
 * the root and for an empty search scope.
 */
export const ProjectRootLink = (props: {projectPath?: string; className?: string}) => {
    const {projectPath, className} = props;
    const clickable = !!projectPath;
    return (
        <Tooltip content={projectPath}>
            <span
                className={cn("text-text-primary/80", clickable && "cursor-pointer hover:underline", className)}
                onClick={clickable ? (e) => {
                    e.stopPropagation();
                    void getAdapter().openFile(projectPath!);
                } : undefined}
            >
                project root
            </span>
        </Tooltip>
    );
};

export const JetBrainsFileLink = (props: {
    path: string;
    label?: string;
    projectPath?: string;
    gateOnCreate?: boolean;
}) => {
    const {path, label, projectPath, gateOnCreate = false} = props;
    const status = useToolStatus();

    // A "." / "" path is the project root — show it consistently, not as a dot.
    if (!label && isProjectRoot(path)) return <ProjectRootLink projectPath={projectPath} />;

    const clickable = !!path && (!gateOnCreate || status === 'success');
    const abs = joinProjectPath(projectPath, path);
    const base = label ?? basename(path);
    const dir = label ? '' : dirname(path);

    // Hover underlines the WHOLE link (dir + filename) and a click anywhere opens
    // the file — one unit, so the dimmed directory never reads as "open folder".
    // stopPropagation keeps a click from also toggling a parent CollapsibleBox.
    return (
        <Tooltip content={abs}>
            <span
                className={cn("font-mono text-[0.8461rem] truncate", clickable && "cursor-pointer hover:underline")}
                onClick={clickable ? (e) => {
                    e.stopPropagation();
                    void getAdapter().openFile(abs);
                } : undefined}
            >
                {dir && <span className="text-text-primary/40">{dir}</span>}
                <span className="text-text-primary/80">{base}</span>
            </span>
        </Tooltip>
    );
};

/** Small pill matching the native DiffCard badge style. */
export const Badge = (props: {children?: ReactNode; tone?: 'default' | 'success' | 'error' | 'warning'; title?: string}) => {
    const {children, tone = 'default', title} = props;
    const toneCls =
        tone === 'success' ? 'bg-state-success-bg text-state-success-fg'
        : tone === 'error' ? 'bg-state-error-bg text-state-error-fg'
        : tone === 'warning' ? 'bg-state-warning-bg text-state-warning-fg'
        : 'bg-surface-hover text-text-tertiary';
    const badge = <span className={cn("px-2 py-0.5 text-xs rounded shrink-0", title && "cursor-help", toneCls)}>{children}</span>;
    return title ? <Tooltip content={title}>{badge}</Tooltip> : badge;
};

/**
 * Confirms WHICH project an MCP tool acts on (its `projectPath`), shown on every
 * card. Compact when it's the current session project ("current project", full
 * path on hover); a yellow full-path warning when it targets a different project
 * or none was specified — so a tool can't silently act on the wrong project.
 */
export const ProjectPathChip = () => {
    const toolUse = useCurrentToolUse();
    const wd = useWorkingDirOrNull();
    const raw = inputProjectPath(toolUse?.input);
    const path = raw ? raw : undefined; // inputProjectPath already drops "null"/non-strings

    // No projectPath → render nothing. It's absent for most of the input stream
    // (so a "not specified" badge would flash on every call), and a call that
    // truly omits it just fails in the MCP server — nothing to confirm here.
    if (!path) return null;

    const norm = (p: string) => p.replace(/\/+$/, '');
    const current = norm(path);
    const matches = !!wd && (
        (!!wd.workingDirectory && norm(wd.workingDirectory) === current)
        || (!!wd.ideRoot && norm(wd.ideRoot) === current)
    );
    const known = !!wd && (!!wd.workingDirectory || !!wd.ideRoot);

    if (matches) {
        return (
            <div className="mt-1">
                <Badge tone="default" title={path}>current project</Badge>
            </div>
        );
    }
    // Either a different project, or the current project is unknown (no provider):
    // either way show the full path; warn only when we know it differs.
    return (
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
            {known && <Badge tone="warning">different project</Badge>}
            <Tooltip content={path}>
                <span className={cn("font-mono text-[0.8461rem] truncate", known ? "text-state-warning-fg" : "text-text-primary/60")}>
                    {path}
                </span>
            </Tooltip>
        </div>
    );
};

/**
 * A clickable `path` (or `path:line`) row used by search / problems / file
 * lists. The displayed text is the relative path; the opened path is resolved
 * against `projectPath`. Always clickable — result rows reference existing files.
 */
export const PathRow = (props: {path: string; line?: number; projectPath?: string; left?: ReactNode; right?: ReactNode}) => {
    const {path, line, projectPath, left, right} = props;
    const clickable = !!path;
    const abs = joinProjectPath(projectPath, path);
    const loc = line ? `${path}:${line}` : path;
    const titleAbs = line ? `${abs}:${line}` : abs;

    return (
        <div className="flex items-center gap-2 text-[0.8461rem]">
            {left}
            <Tooltip content={titleAbs}>
                <span
                    className={cn("font-mono text-text-primary/80 truncate", clickable && "cursor-pointer hover:underline")}
                    onClick={clickable ? (e) => {
                        // stopPropagation so opening a row doesn't also toggle the
                        // surrounding CollapsibleBox; line focuses the result in-IDE.
                        e.stopPropagation();
                        void getAdapter().openFile(abs, line);
                    } : undefined}
                >
                    {loc}
                </span>
            </Tooltip>
            {right}
        </div>
    );
};

/** A list of project-relative files (e.g. the targets of reformat / lint / build). */
export const FileList = (props: {files: string[]; projectPath?: string}) => (
    <div className="mt-1 flex flex-col gap-0.5">
        {props.files.map((f, i) => <PathRow key={i} path={f} projectPath={props.projectPath} />)}
    </div>
);

/** Where a search runs: "in <glob list>" from `paths`, or a clickable "project root" when empty. */
export const ScopeText = (props: {paths?: unknown; projectPath?: string}) => {
    const list = Array.isArray(props.paths) ? props.paths.filter((p): p is string => typeof p === 'string' && !!p) : [];
    return (
        <span className="text-text-primary/50 truncate">
            in {list.length ? list.join(', ') : <ProjectRootLink projectPath={props.projectPath} />}
        </span>
    );
};

/**
 * Bash-style IN/OUT box, reused for tools whose input is itself worth reviewing
 * (terminal command, debugger expression). IN holds the request, OUT the result.
 */
export const InOutBlock = (props: {
    inContent?: ReactNode;
    outContent?: ReactNode;
    inLabel?: string;
    outLabel?: string;
}) => {
    const {inContent, outContent, inLabel = 'IN', outLabel = 'OUT'} = props;
    return (
        <Container className="mt-1.5">
            <LabelValue label={inLabel} className="border-b border-border-subtle" maxHeight="max-h-[80px]">
                {inContent}
            </LabelValue>
            <LabelValue label={outLabel} maxHeight="max-h-[140px]">
                {outContent}
            </LabelValue>
        </Container>
    );
};

/**
 * Marks a result region as the tool's OUT for cards that have no IN/OUT block,
 * so the output can't be mistaken for the header/input above it. Two forms per
 * the result's shape:
 *  - `OutBlock`: code/mono results — the framed OUT half of an InOutBlock.
 *  - `OutLabel`: inline results (status badges, short text) — a dim "OUT" caption.
 */
export const OutBlock = (props: {children?: ReactNode; maxHeight?: string}) => (
    <Container className="mt-1.5">
        <LabelValue label="OUT" maxHeight={props.maxHeight ?? 'max-h-[140px]'}>{props.children}</LabelValue>
    </Container>
);

export const OutLabel = (props: {children?: ReactNode}) => (
    <div className="mt-1.5">
        <div className="text-tool-label-fg text-[0.7692rem] uppercase tracking-wide">OUT</div>
        {props.children}
    </div>
);

/**
 * Compact debugger outcome: status badge, value change (old → new), applied /
 * result message — shown instead of raw JSON (the IDE's own debugger panel is
 * the rich view). paused/running/stopped are normal states, so only 'timeout'
 * is warning-toned.
 */
export const DebuggerOutcomeRow = ({outcome}: {outcome: DebuggerOutcome}) => (
    <div className="flex flex-wrap items-center gap-1.5 text-[0.8461rem]">
        {outcome.status && (
            <Badge tone={outcome.status === 'timeout' ? 'warning' : 'default'}>{outcome.status}</Badge>
        )}
        {outcome.oldValue !== undefined && (
            <span className="font-mono text-text-primary/80">{outcome.oldValue} → {outcome.newValue}</span>
        )}
        {outcome.applied !== undefined && (
            <Badge tone={outcome.applied ? 'success' : 'error'}>{outcome.applied ? 'applied' : 'not applied'}</Badge>
        )}
        {outcome.message && <span className="text-text-primary/70">{outcome.message}</span>}
    </div>
);

function formatFieldValue(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Security backstop: surfaces any input field we don't handle natively — keys
 * absent from the tool's schema, or known keys with an unexpected type. Renders
 * nothing when the input is clean. When present it sits directly under the
 * header (never buried), warning-toned and expanded, so a field can't be
 * smuggled past the user's approval. Distinct from the intentional IN/OUT block.
 */
export const UnrecognizedInputNotice = (props: {toolName: string; input: Record<string, unknown>}) => {
    const fields = surprisingFields(props.toolName, props.input);
    if (!fields.length) return null;

    return (
        <div className="mt-1.5 rounded border border-state-warning-fg/40 bg-state-warning-bg/40 p-2 text-[0.8461rem]">
            <div className="flex items-center gap-1.5 mb-1 text-state-warning-fg font-medium">
                <span aria-hidden>⚠</span>
                <span>Unrecognized input — review before allowing</span>
            </div>
            <div className="flex flex-col gap-0.5 font-mono text-text-primary/80">
                {fields.map((f) => (
                    <div key={f.key} className="whitespace-pre-wrap break-all">
                        <span className="text-text-primary">{f.key}</span>
                        {f.reason === 'type' && <span className="text-state-warning-fg"> (unexpected type)</span>}
                        <span className="text-text-primary/50">: </span>
                        {formatFieldValue(f.value)}
                    </div>
                ))}
            </div>
        </div>
    );
};

/** Distinct error line (the leading status dot is already red on error). */
export const JetBrainsErrorRow = (props: {children?: ReactNode}) => (
    <div className="mt-1 text-[0.8461rem] font-mono text-state-error-fg whitespace-pre-wrap">{props.children}</div>
);

/**
 * Neutral note for a user's denial decision — deliberately NOT red, so it can't
 * be mistaken for a tool failure or an "MCP server disabled" error. Shows the
 * instruction the user gave Claude (if any).
 */
export const JetBrainsDeclinedNote = (props: {instruction?: string}) => (
    <div className="mt-1 flex items-start gap-1.5 text-[0.8461rem]">
        <Badge>declined</Badge>
        {props.instruction
            ? <span className="text-text-primary/70 italic whitespace-pre-wrap">“{props.instruction}”</span>
            : <span className="text-text-tertiary">You declined this tool.</span>}
    </div>
);

/**
 * Renders the tool's result when it didn't run normally: a user's decline as a
 * neutral note, or a real `is_error` failure in red. Otherwise nothing — letting
 * a renderer show its normal body only on success.
 */
export const JetBrainsResultError = (props: {toolResult?: LoadedMessageDto}) => {
    const declined = parseUserDeclined(toolResultText(props.toolResult));
    if (declined) return <JetBrainsDeclinedNote instruction={declined.instruction} />;
    if (!toolResultIsError(props.toolResult)) return null;
    return <JetBrainsErrorRow>{toolResultText(props.toolResult)}</JetBrainsErrorRow>;
};
