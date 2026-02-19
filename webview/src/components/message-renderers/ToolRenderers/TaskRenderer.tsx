import {ToolUseBlockDto} from "@/types";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class TaskToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        description: string;
        subagent_type?: string;
        prompt: string;
    };
}

export function TaskRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskToolUseDto;
    // const toolResult = props.toolResult as BashToolResultDto | undefined;

    const name = toolUse.name;
    const description = toolUse.input?.description ?? '';
    const input = toolUse.input?.prompt ?? '' as string;
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper>
            <ToolHeader name={name} description={description} />

            <Container>
                <LabelValue
                    label="IN"
                    className="border-b border-white/15"
                    maxHeight="max-h-[60px]"
                >
                    {input}
                </LabelValue>
            </Container>
        </ToolWrapper>
    )
}
