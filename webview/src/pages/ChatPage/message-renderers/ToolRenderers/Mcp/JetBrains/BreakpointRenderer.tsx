import {ReactNode} from "react";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, Container, LabelValue} from "../../common";
import {
    JetBrainsToolHeader, JetBrainsResultError, PathRow, Badge, OutLabel, OutBlock, DebuggerOutcomeRow,
    jetbrainsToolSuffix, inputProjectPath, isTrivialResult, prettyResult, resultIndicatesError,
    debuggerOutcome, debuggerHasExtraPayload,
} from "./_shared";

/**
 * `xdebug_set_breakpoint` / `xdebug_remove_breakpoint`.
 *
 * The header stays minimal — only the product name, the action, and (for set)
 * the `file:line` target. Everything that modifies the breakpoint's behavior
 * lives BELOW the header, never crammed into the title:
 *  - set: neutral flag badges (logpoint / suspend / muted / temporary / disabled
 *    / log msg / log stack) and, since `condition` and `logExpression` are
 *    evaluated code, a labeled code block (`if` / `log`) like evaluate_expression.
 *  - remove: the target breakpoint(s) listed like search-result rows (a
 *    `file:line` row or a raw `id`), plus the `owner` (who created it) when set.
 * The result is marked OUT so it can't be mistaken for the input above it.
 */
export function BreakpointRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const {toolUse, toolResult, message} = props;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const isRemove = jetbrainsToolSuffix(toolUse.name) === 'xdebug_remove_breakpoint';
    const projectPath = inputProjectPath(input);
    const isError = toolResultIsError(toolResult);
    const out = toolResultText(toolResult);

    const file = typeof input.filePath === 'string' && input.filePath ? input.filePath : undefined;
    const line = typeof input.line === 'number' ? input.line : undefined;
    const breakpointId = typeof input.breakpointId === 'string' && input.breakpointId ? input.breakpointId : undefined;

    // set-only: condition / logExpression are evaluated code → shown as a block.
    const condition = typeof input.condition === 'string' && input.condition ? input.condition : undefined;
    const logExpression = typeof input.logExpression === 'string' && input.logExpression ? input.logExpression : undefined;

    // Neutral behavior-flag badges (ordinary debugging params, not warnings).
    const flags: ReactNode[] = [];
    if (logExpression) flags.push(<Badge key="lp">{t('jetbrains.breakpoint.logpoint')}</Badge>);
    if (typeof input.suspendPolicy === 'string') flags.push(<Badge key="sp">{t('jetbrains.breakpoint.suspend', {policy: input.suspendPolicy})}</Badge>);
    // breakpointsMuted toggles the IDE's global breakpoint mute — an explicit
    // action either way, so surface it whenever present (not only when true).
    if (typeof input.breakpointsMuted === 'boolean') {
        flags.push(
            <Badge key="mu">
                {input.breakpointsMuted ? t('jetbrains.breakpoint.breakpointsMuted') : t('jetbrains.breakpoint.breakpointsUnmuted')}
            </Badge>,
        );
    }
    if (input.temporary === true) flags.push(<Badge key="tmp">{t('jetbrains.breakpoint.temporary')}</Badge>);
    if (input.enabled === false) flags.push(<Badge key="dis">{t('jetbrains.breakpoint.disabled')}</Badge>);
    if (input.isLogMessage === true) flags.push(<Badge key="lm">{t('jetbrains.breakpoint.logMessage')}</Badge>);
    if (input.isLogStack === true) flags.push(<Badge key="ls">{t('jetbrains.breakpoint.logStack')}</Badge>);

    // remove-only: who owns the breakpoint being removed (e.g. `agent`).
    const owner = isRemove && typeof input.owner === 'string' && input.owner ? input.owner : undefined;

    const outcome = !isError && !debuggerHasExtraPayload(out) ? debuggerOutcome(out) : null;

    return (
        <ToolWrapper
            message={message}
            groupClassName="pb-2.5"
            forceStatus={resultIndicatesError(out) ? 'error' : undefined}
        >
            <JetBrainsToolHeader
                name={toolUse.name}
                path={isRemove ? undefined : file}
                projectPath={projectPath}
                extra={!isRemove && line != null ? <span className="text-text-primary/50 shrink-0">:{line}</span> : undefined}
                input={input}
            />
            {isError ? (
                <JetBrainsResultError toolResult={toolResult} />
            ) : (
                <>
                    {isRemove && (
                        file ? (
                            <div className="mt-1"><PathRow path={file} line={line} projectPath={projectPath} /></div>
                        ) : breakpointId ? (
                            <div className="mt-1 font-mono text-[0.8461rem] text-text-primary/80">{t('jetbrains.breakpoint.id', {id: breakpointId})}</div>
                        ) : null
                    )}
                    {owner && <div className="mt-1"><Badge>{t('jetbrains.breakpoint.owner', {owner})}</Badge></div>}
                    {!isRemove && flags.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">{flags}</div>
                    )}
                    {!isRemove && (condition || logExpression) && (
                        <Container className="mt-1.5">
                            {condition && (
                                <LabelValue label={t('jetbrains.breakpoint.conditionLabel')} className={logExpression ? "border-b border-border-subtle" : undefined}>
                                    {condition}
                                </LabelValue>
                            )}
                            {logExpression && <LabelValue label={t('jetbrains.breakpoint.logLabel')}>{logExpression}</LabelValue>}
                        </Container>
                    )}
                    {outcome ? (
                        <OutLabel><DebuggerOutcomeRow outcome={outcome} /></OutLabel>
                    ) : out && !isTrivialResult(out) ? (
                        <OutBlock>{prettyResult(out)}</OutBlock>
                    ) : null}
                </>
            )}
        </ToolWrapper>
    );
}
