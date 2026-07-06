import { ToolUseBlockDto } from "@/dto";
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "./common";
import { useTranslation } from "@/i18n";

class TaskGetToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        taskId: string;
    };
}

interface TaskGetToolResultDto {
    message: {
        content: [{ content: string }];
    };
}

export function TaskGetRenderer(props: RendererProps) {
    const { t } = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as TaskGetToolUseDto;
    const toolResult = props.toolResult as TaskGetToolResultDto | undefined;

    const name = toolUse.name;
    const taskId = toolUse.input?.taskId ?? '';
    const output = toolResult?.message?.content?.[0]?.content ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} inProgress={!toolResult} className="mb-2.5">
                <div className="text-text-primary/60">{`#${taskId}`}</div>
            </ToolHeader>

            <Container>
                <LabelValue label={t('task.common.out')} maxHeight="max-h-[60px]">
                    {output}
                </LabelValue>
            </Container>
        </ToolWrapper>
    );
}
