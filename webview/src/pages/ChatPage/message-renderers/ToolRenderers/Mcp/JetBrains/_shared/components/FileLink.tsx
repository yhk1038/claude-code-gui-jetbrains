import {ReactNode} from "react";
import {getAdapter} from "@/adapters";
import {Tooltip} from "@/components";
import {cn} from "@/utils/cn";
import {useToolStatus} from "../../../../common";
import {basename, dirname, joinProjectPath} from "../helpers";

const ROOT_PATHS = new Set(['', '.', './']);
/** True for the project-root reference ('' / '.' / './'); false for a non-string. */
function isProjectRoot(path: string): boolean {
    return ROOT_PATHS.has((typeof path === 'string' ? path : '').trim());
}

interface ProjectRootLinkProps {
    projectPath?: string;
    className?: string;
}

/**
 * The project-root reference, shown consistently as a clickable "project root"
 * (never a bare ".") that opens the project directory. Used for tools targeting
 * the root and for an empty search scope.
 */
export const ProjectRootLink = (props: ProjectRootLinkProps) => {
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

interface JetBrainsFileLinkProps {
    path: string;
    label?: string;
    projectPath?: string;
    /** Gate the link until success — only for targets that don't exist yet (create). */
    gateOnCreate?: boolean;
}

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
export const JetBrainsFileLink = (props: JetBrainsFileLinkProps) => {
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

interface PathRowProps {
    path: string;
    line?: number;
    projectPath?: string;
    left?: ReactNode;
    right?: ReactNode;
}

/**
 * A clickable `path` (or `path:line`) row used by search / problems / file
 * lists. The displayed text is the relative path; the opened path is resolved
 * against `projectPath`. Always clickable — result rows reference existing files.
 */
export const PathRow = (props: PathRowProps) => {
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

interface FileListProps {
    files: string[];
    projectPath?: string;
}

/** A list of project-relative files (e.g. the targets of reformat / lint / build). */
export const FileList = (props: FileListProps) => (
    <div className="mt-1 flex flex-col gap-0.5">
        {props.files.map((f, i) => <PathRow key={i} path={f} projectPath={props.projectPath} />)}
    </div>
);

interface ScopeTextProps {
    paths?: unknown;
    projectPath?: string;
}

/** Where a search runs: "in <glob list>" from `paths`, or a clickable "project root" when empty. */
export const ScopeText = (props: ScopeTextProps) => {
    const list = Array.isArray(props.paths) ? props.paths.filter((p): p is string => typeof p === 'string' && !!p) : [];
    return (
        <span className="text-text-primary/50 truncate">
            in {list.length ? list.join(', ') : <ProjectRootLink projectPath={props.projectPath} />}
        </span>
    );
};
