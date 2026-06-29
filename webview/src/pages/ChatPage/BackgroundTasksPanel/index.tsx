import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Portal } from '@/components/Portal';
import { useWorkflowState } from '@/contexts/WorkflowStateContext';
import type { WorkflowTask } from '@/shared';
import { agentDotClass, formatDuration, formatTokens, WORKFLOW_STATUS_COLOR } from '@/utils/workflowFormat';

/** Re-render every second while `active` so running timers tick. */
function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

function WorkflowTaskRow({
    task,
    now,
    focused,
    onDismiss,
}: {
    task: WorkflowTask;
    now: number;
    focused: boolean;
    onDismiss: (toolUseId: string) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [focused]);

    const isRunning = task.status === 'running';
    const statusColor = WORKFLOW_STATUS_COLOR[task.status] || 'text-text-primary/60';
    const agentCount = task.agents.length || task.usage?.agentCount;
    const durationMs =
        task.usage?.durationMs ?? (isRunning ? now - task.startedAt : undefined);
    const duration = formatDuration(durationMs);
    // Authoritative workflow-level total first; per-agent sum is only a fallback
    // (see WorkflowRenderer) so the header stays consistent with the agent table.
    const liveTokens = task.agents.reduce((sum, a) => sum + (a.tokens || 0), 0);
    const tokens = formatTokens(task.usage?.subagentTokens || liveTokens);

    return (
        <div
            ref={ref}
            className={`rounded-lg border bg-surface-base px-3 py-2.5 ${
                focused ? 'border-border-focus' : 'border-border-subtle'
            }`}
        >
            <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 text-text-primary text-[0.9230rem] font-semibold truncate">
                    {task.name}
                </div>
                <span className={`text-[0.8461rem] shrink-0 ${statusColor}`}>{task.status}</span>
                <button
                    onClick={() => onDismiss(task.toolUseId)}
                    className="shrink-0 p-0.5 rounded hover:bg-surface-hover transition-colors"
                    title={isRunning ? 'Dismiss (clears a stuck workflow)' : 'Dismiss'}
                >
                    <XMarkIcon className="w-3.5 h-3.5 text-text-tertiary hover:text-text-secondary" />
                </button>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8461rem] text-text-primary/60">
                <span>Workflow</span>
                {agentCount !== undefined && (
                    <>
                        <span className="text-text-tertiary">·</span>
                        <span>{agentCount} agents</span>
                    </>
                )}
                {tokens && (
                    <>
                        <span className="text-text-tertiary">·</span>
                        <span>{tokens} tokens</span>
                    </>
                )}
                {duration && (
                    <>
                        <span className="text-text-tertiary">·</span>
                        <span>{duration}</span>
                    </>
                )}
            </div>

            {task.description && (
                <div className="mt-1 text-[0.8461rem] text-text-primary/50">{task.description}</div>
            )}

            {task.phases.length > 0 && (
                <div className="mt-2">
                    <div className="text-[0.7692rem] uppercase tracking-wide text-text-tertiary mb-1">Phases</div>
                    <div className="space-y-0.5">
                        {task.phases.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-[0.8461rem] text-text-primary/70">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                                <span className="truncate">{p.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {task.agents.length > 0 && (
                <div className="mt-2 overflow-x-auto no-scrollbar">
                    <table className="w-full text-[0.8461rem] font-mono">
                        <thead>
                            <tr className="text-text-tertiary text-left">
                                <th className="font-normal pb-1 pr-2">Agent</th>
                                <th className="font-normal pb-1 px-2 text-right">Tokens</th>
                                <th className="font-normal pb-1 px-2 text-right">Tools</th>
                                <th className="font-normal pb-1 pl-2 text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {task.agents.map((a) => (
                                <tr key={a.agentId} className="text-text-primary/75">
                                    <td className="py-0.5 pr-2 max-w-[10rem] truncate">
                                        <span
                                            className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${agentDotClass(a.status)}`}
                                        />
                                        {a.label}
                                    </td>
                                    <td className="py-0.5 px-2 text-right">{formatTokens(a.tokens) ?? '0'}</td>
                                    <td className="py-0.5 px-2 text-right">{a.tools}</td>
                                    <td className="py-0.5 pl-2 text-right">{formatDuration(a.durationMs) ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    );
}

export function BackgroundTasksPanel() {
    const { panelOpen, closePanel, runningTasks, finishedTasks, clearFinished, dismissTask, focusedToolUseId } =
        useWorkflowState();
    const [showFinished, setShowFinished] = useState(true);
    const panelRef = useRef<HTMLDivElement>(null);
    const now = useNow(panelOpen && runningTasks.length > 0);

    // When the panel opens, move focus into it so keystrokes (notably Escape)
    // act on the panel — closing it — instead of the chat input behind it. On
    // close, restore focus to wherever it was (e.g. the chat input).
    useEffect(() => {
        if (!panelOpen) return;
        const prevFocus = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        return () => prevFocus?.focus?.();
    }, [panelOpen]);

    if (!panelOpen) return null;

    return (
        <Portal>
            <div
                ref={panelRef}
                tabIndex={-1}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        closePanel();
                    }
                }}
                className="fixed right-0 top-0 bottom-0 w-[24rem] max-w-[92vw] z-40 flex flex-col bg-surface-raised border-l border-border-default shadow-2xl outline-none"
            >
                <div className="flex items-center justify-between px-4 h-[44px] border-b border-border-subtle shrink-0">
                    <div className="text-text-primary text-[1rem] font-semibold">Background tasks</div>
                    <button
                        onClick={closePanel}
                        className="p-1 rounded hover:bg-surface-hover transition-colors"
                        title="Close"
                    >
                        <XMarkIcon className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {runningTasks.length === 0 && finishedTasks.length === 0 && (
                        <div className="text-text-primary/50 text-[0.9230rem] text-center mt-8">
                            No background workflows yet.
                        </div>
                    )}

                    {runningTasks.length > 0 && (
                        <section className="space-y-2">
                            <div className="text-[0.7692rem] uppercase tracking-wide text-text-tertiary">Running</div>
                            {runningTasks.map((t) => (
                                <WorkflowTaskRow
                                    key={t.toolUseId}
                                    task={t}
                                    now={now}
                                    focused={t.toolUseId === focusedToolUseId}
                                    onDismiss={dismissTask}
                                />
                            ))}
                        </section>
                    )}

                    {finishedTasks.length > 0 && (
                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setShowFinished((v) => !v)}
                                    className="text-[0.7692rem] uppercase tracking-wide text-text-tertiary hover:text-text-secondary transition-colors"
                                >
                                    Finished {finishedTasks.length} {showFinished ? '▾' : '▸'}
                                </button>
                                <button
                                    onClick={clearFinished}
                                    className="text-[0.8461rem] text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                            {showFinished &&
                                finishedTasks.map((t) => (
                                    <WorkflowTaskRow
                                        key={t.toolUseId}
                                        task={t}
                                        now={now}
                                        focused={t.toolUseId === focusedToolUseId}
                                        onDismiss={dismissTask}
                                    />
                                ))}
                        </section>
                    )}
                </div>
            </div>
        </Portal>
    );
}
