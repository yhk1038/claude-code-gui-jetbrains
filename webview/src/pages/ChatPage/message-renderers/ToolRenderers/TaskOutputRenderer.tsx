import { useState } from 'react';
import { ToolUseBlockDto } from '@/dto';
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from './common';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType } from '@/shared';
import { parseXmlTag } from '@/utils/parseXmlTag';

class TaskOutputToolUseDto extends ToolUseBlockDto {
    declare input: {
        task_id: string;
        block?: boolean;
        timeout?: number;
    };
}

enum RetrievalStatus {
    Success = 'success',
    Timeout = 'timeout',
    Error = 'error',
}

enum TaskStatus {
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Stopped = 'stopped',
}

function retrievalStatusLabel(status: string): string {
    switch (status) {
        case RetrievalStatus.Success: return 'completed';
        case RetrievalStatus.Timeout: return 'timed out';
        case RetrievalStatus.Error: return 'error';
        default: return status;
    }
}

function taskStatusColor(status: string): string {
    switch (status) {
        case TaskStatus.Running: return 'text-text-link';
        case TaskStatus.Completed: return 'text-state-success-fg';
        case TaskStatus.Failed: return 'text-state-error-fg';
        case TaskStatus.Stopped: return 'text-state-warning-fg';
        default: return 'text-text-primary/60';
    }
}

export function TaskOutputRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskOutputToolUseDto;
    const taskId = toolUse.input?.task_id ?? '';

    const { workingDirectory } = useWorkingDir();
    const { send } = useBridgeContext();

    const [copied, setCopied] = useState(false);

    const toolResult = props.toolResult as {
        message?: { content?: Array<{ content?: string | Array<{ type?: string; content?: string }> }> }
    } | undefined;

    const rawContent = toolResult?.message?.content?.[0]?.content;
    const resultText = typeof rawContent === 'string'
        ? rawContent
        : (Array.isArray(rawContent) ? rawContent[0]?.content ?? '' : '');

    const retrievalStatus = parseXmlTag(resultText, 'retrieval_status');
    const taskType = parseXmlTag(resultText, 'task_type');
    const taskStatus = parseXmlTag(resultText, 'status');

    const xmlOutput = parseXmlTag(resultText, 'output');
    const stdout = parseXmlTag(resultText, 'stdout');
    const stderr = parseXmlTag(resultText, 'stderr');
    const output = xmlOutput || stdout || stderr || resultText;
    const hasMeta = !!(taskType || taskStatus || retrievalStatus);

    const description = taskStatus
        ? `${taskId} — ${taskStatus}`
        : taskId;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!taskId) return;

        let command: string;
        if (workingDirectory) {
            try {
                const res = await send(MessageType.FIND_BG_TASK_OUTPUT_PATH, {
                    taskId,
                    workingDir: workingDirectory,
                });
                const path = (res as { path?: string | null })?.path;
                command = path ? `tail -f ${path}` : taskId;
            } catch {
                command = taskId;
            }
        } else {
            command = taskId;
        }

        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('[TaskOutputRenderer] clipboard write failed:', err);
        }
    };

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="TaskOutput" inProgress={!props.toolResult} className="mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="text-text-primary/60 truncate text-[0.9230rem] cursor-pointer hover:text-text-primary/90 transition-colors"
                        onClick={handleCopy}
                    >
                        task: "{description}"
                    </div>
                    {copied && (
                        <span className="text-state-success-fg text-[0.8461rem] shrink-0">Copied</span>
                    )}
                </div>
            </ToolHeader>

            {props.toolResult && output && (
                <Container>
                    {hasMeta && (
                        <div className="flex items-start p-2 gap-4 text-[0.8461rem] font-mono">
                            {taskType && (
                                <div>
                                    <span className="text-text-primary/40">type </span>
                                    <span className="text-text-primary/80">{taskType}</span>
                                </div>
                            )}
                            {taskStatus && (
                                <div>
                                    <span className="text-text-primary/40">status </span>
                                    <span className={taskStatusColor(taskStatus)}>{taskStatus}</span>
                                </div>
                            )}
                            {retrievalStatus && (
                                <div>
                                    <span className="text-text-primary/40">retrieval </span>
                                    <span className="text-text-primary/80">{retrievalStatusLabel(retrievalStatus)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <LabelValue
                        label="OUT"
                        className={hasMeta ? "border-t border-border-subtle" : undefined}
                        maxHeight="max-h-[105px]"
                    >
                        {output}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
