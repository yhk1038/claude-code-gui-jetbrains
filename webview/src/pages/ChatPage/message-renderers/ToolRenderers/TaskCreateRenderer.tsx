import { ToolUseBlockDto } from "@/dto";
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "./common";

class TaskCreateToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        subject: string;
        description: string;
        activeForm?: string;
        metadata?: Record<string, string | number | boolean | null>;
    };
}

export function TaskCreateRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskCreateToolUseDto;

    const name = toolUse.name;
    const subject = toolUse.input?.subject ?? '';
    const description = toolUse.input?.description ?? '';
    const activeForm = toolUse.input?.activeForm;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-text-primary/60">{subject}</div>
            </ToolHeader>

            <Container>
                <LabelValue
                    label="WHAT"
                    className={activeForm ? 'border-b border-border-subtle' : ''}
                    maxHeight="max-h-[60px]"
                >
                    {description}
                </LabelValue>
                {activeForm && (
                    <LabelValue label="FORM" maxHeight="max-h-[60px]">
                        {activeForm}
                    </LabelValue>
                )}
            </Container>
        </ToolWrapper>
    );
}
