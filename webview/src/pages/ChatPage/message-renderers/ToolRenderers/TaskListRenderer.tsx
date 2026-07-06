import { ToolUseBlockDto } from "@/dto";
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "./common";
import { useTranslation } from "@/i18n";

class TaskListToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: Record<string, never>;
}

interface TaskListToolResultDto {
    message: {
        content: [{ content: string }];
    };
}

export function TaskListRenderer(props: RendererProps) {
    const { t } = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as TaskListToolUseDto;
    const toolResult = props.toolResult as TaskListToolResultDto | undefined;

    const name = toolUse.name;
    const output = toolResult?.message?.content?.[0]?.content ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} inProgress={!toolResult} className="mb-2.5" />

            <Container>
                <LabelValue label={t('task.common.out')} maxHeight="max-h-[60px]">
                    {output}
                </LabelValue>
            </Container>
        </ToolWrapper>
    );
}
