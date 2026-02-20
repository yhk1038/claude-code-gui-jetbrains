import {ToolUseBlockDto} from "@/dto";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class AskUserQuestionToolUseDto extends ToolUseBlockDto {
    declare input: {
        questions: Array<{
            question: string;
            header: string;
            options: Array<{
                label: string;
                description: string;
            }>;
            multiSelect: boolean;
        }>;
    };
}

export function AskUserQuestionRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as AskUserQuestionToolUseDto;
    const toolResult = props.toolResult as { message?: { content: Array<{ content: string }> } } | undefined;
    const output = toolResult?.message?.content?.[0]?.content ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={toolUse.name} inProgress={!props.toolResult} className="mb-2.5" />

            <Container>
                <LabelValue label="OUT" maxHeight="max-h-[60px]">
                    {props.toolResult ? output : ''}
                </LabelValue>
            </Container>
        </ToolWrapper>
    );
}
