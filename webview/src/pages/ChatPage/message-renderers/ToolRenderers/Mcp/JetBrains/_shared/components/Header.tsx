import {ReactNode} from "react";
import {Tooltip} from "@/components";
import {cn} from "@/utils/cn";
import {useTranslation} from "@/i18n";
import {useWorkingDirOrNull} from "@/contexts/WorkingDirContext";
import {ToolHeader, useCurrentToolUse} from "../../../../common";
import {jetbrainsProductName, toolTitle, inputProjectPath} from "../helpers";
import {Badge} from "./Badge";
import {JetBrainsFileLink} from "./FileLink";
import {SensitiveInputDisclosure, UnrecognizedInputNotice} from "./ResultRows";

interface JetBrainsToolHeaderProps {
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
}

/**
 * Header shaped exactly like the native tool cards (e.g. Bash): the bold
 * product name (IntelliJ IDEA / PyCharm / …) followed by a dim human action
 * description and an optional clickable file link styled like native `Read`.
 */
export const JetBrainsToolHeader = (props: JetBrainsToolHeaderProps) => {
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
            {input && <SensitiveInputDisclosure toolName={name} input={input} />}
            {input && <UnrecognizedInputNotice toolName={name} input={input} />}
        </>
    );
};

/**
 * Confirms WHICH project an MCP tool acts on (its `projectPath`), shown on every
 * card. Compact when it's the current session project ("current project", full
 * path on hover); a yellow full-path warning when it targets a different project
 * or none was specified — so a tool can't silently act on the wrong project.
 */
export const ProjectPathChip = () => {
    const {t} = useTranslation('chatTools');
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
                <Badge tone="default" title={path}>{t('jetbrains.common.currentProject')}</Badge>
            </div>
        );
    }
    // Either a different project, or the current project is unknown (no provider):
    // either way show the full path; warn only when we know it differs.
    return (
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
            {known && <Badge tone="warning">{t('jetbrains.common.differentProject')}</Badge>}
            <Tooltip content={path}>
                <span dir="ltr" className={cn("font-mono text-[0.8461rem] truncate", known ? "text-state-warning-fg" : "text-text-primary/60")}>
                    {path}
                </span>
            </Tooltip>
        </div>
    );
};
