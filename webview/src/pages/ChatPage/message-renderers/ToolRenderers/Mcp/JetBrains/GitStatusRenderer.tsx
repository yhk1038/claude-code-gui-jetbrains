import {useTranslation} from "@/i18n";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, ResultCaption} from "../../common";
import {CollapsibleBox} from "../_common";
import {JetBrainsToolHeader, JetBrainsResultError, PathRow, Badge, RawJsonResult, safeParseJson, asArray, asObjects, inputProjectPath, joinProjectPath} from "./_shared";

interface GitEntry {
    pathRelativeToRepository: string;
    indexStatus?: string;
    workTreeStatus?: string;
}

interface GitRepo {
    repositoryPathRelativeToProject?: string;
    totalEntries?: number;
    entries?: GitEntry[];
}

interface GitStatusResult {
    repositories?: GitRepo[];
}

/** Translation-key form of the status label (falls back to the raw status code for anything unrecognized). */
function statusInfo(idx?: string, wt?: string): {labelKey?: string; raw?: string; tone: 'default' | 'success' | 'error' | 'warning'} {
    const c = typeof wt === 'string' && wt.trim() ? wt : idx;
    switch (c) {
        case '?': return {labelKey: 'untracked', tone: 'default'};
        case 'M': return {labelKey: 'modified', tone: 'warning'};
        case 'A': return {labelKey: 'added', tone: 'success'};
        case 'D': return {labelKey: 'deleted', tone: 'error'};
        case 'R': return {labelKey: 'renamed', tone: 'warning'};
        case 'C': return {labelKey: 'copied', tone: 'default'};
        case 'U': return {labelKey: 'conflict', tone: 'error'};
        default: return c ? {raw: c, tone: 'default'} : {labelKey: 'changed', tone: 'default'};
    }
}

/** `git_status`: "N changes" + status-badged file rows across repositories. */
export function GitStatusRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);
    const parsed = safeParseJson<GitStatusResult>(out);
    const hasRepos = Array.isArray(parsed?.repositories);
    const repos = asObjects<GitRepo>(parsed?.repositories);
    const rows = repos.flatMap((r) => asObjects<GitEntry>(r.entries).map((e) => ({e, repoRel: r.repositoryPathRelativeToProject ?? ''})));
    const total = repos.reduce((n, r) => n + (typeof r.totalEntries === 'number' ? r.totalEntries : asArray(r.entries).length), 0);
    const projectPath = inputProjectPath(props.toolUse.input);
    const input = (props.toolUse.input ?? {}) as Record<string, unknown>;
    const flags = [
        input.includeIgnored === true && <Badge key="ign">{t('jetbrains.gitStatus.includeIgnored')}</Badge>,
        input.includeUntracked === true && <Badge key="unt">{t('jetbrains.gitStatus.includeUntracked')}</Badge>,
    ].filter(Boolean);
    const extra = (flags.length || hasRepos) ? (
        <span className="flex items-center gap-1.5">
            {flags}
            {hasRepos && <span className="text-text-primary/50">{t('jetbrains.gitStatus.changeCount', {count: total})}</span>}
        </span>
    ) : undefined;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader
                name={props.toolUse.name}
                input={input}
                extra={extra}
            />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : !hasRepos ? (
                <RawJsonResult out={out} />
            ) : rows.length === 0 ? (
                <ResultCaption className="mt-1">{t('jetbrains.gitStatus.clean')}</ResultCaption>
            ) : (
                <div className="mt-1.5">
                    <CollapsibleBox collapsedMaxHeight={200} className="flex flex-col gap-1">
                        {rows.map(({e, repoRel}, i) => {
                            const s = statusInfo(e.indexStatus, e.workTreeStatus);
                            const base = repoRel ? joinProjectPath(projectPath, repoRel) : projectPath;
                            return (
                                <PathRow
                                    key={i}
                                    path={e.pathRelativeToRepository}
                                    projectPath={base}
                                    left={<Badge tone={s.tone}>{s.labelKey ? t(`jetbrains.gitStatus.status.${s.labelKey}`) : s.raw}</Badge>}
                                />
                            );
                        })}
                    </CollapsibleBox>
                </div>
            )}
        </ToolWrapper>
    );
}
