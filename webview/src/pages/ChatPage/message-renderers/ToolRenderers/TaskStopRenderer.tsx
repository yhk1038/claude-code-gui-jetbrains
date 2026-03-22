import {ToolUseBlockDto} from "@/dto";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class TaskStopToolUseDto extends ToolUseBlockDto {
    declare input: {
        task_id: string;
    };
}

export function TaskStopRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskStopToolUseDto;
    const taskId = toolUse.input?.task_id ?? '';

    const toolResult = props.toolResult as {
        message?: { content?: Array<{ content?: string | Array<{ type?: string; content?: string }> }> }
    } | undefined;

    const rawContent = toolResult?.message?.content?.[0]?.content;
    const resultText = typeof rawContent === 'string'
        ? rawContent
        : (Array.isArray(rawContent) ? rawContent[0]?.content ?? '' : '');

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="TaskStop" inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-white/60 truncate text-[12px]">task: "{taskId}"</div>
            </ToolHeader>

            {props.toolResult && resultText && (
                <Container>
                    <LabelValue label="OUT" maxHeight="max-h-[105px]">
                        {resultText}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}
