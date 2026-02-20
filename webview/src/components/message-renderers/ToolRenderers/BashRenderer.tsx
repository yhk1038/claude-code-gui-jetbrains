import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

interface BashToolUseDto {
    name: string;
    input: {
        command: string;
        description: string;
    };
    tool_result?: BashToolResultDto;
}

interface BashToolResultDto {
    message: {
        content: [{content: string}]
    }
}

export function BashRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as BashToolUseDto;
    const toolResult = props.toolResult as BashToolResultDto | undefined;

    const name = toolUse.name;
    const description = toolUse.input?.description ?? '';
    const input = toolUse.input?.command ?? '' as string;
    const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader
                name={name}
                description={description}
                inProgress={!toolResult}
                className="mb-2.5"
            />

            <Container>
                <LabelValue
                    label="IN"
                    className="border-b border-white/15"
                    maxHeight="max-h-[60px]"
                >
                    {input}
                </LabelValue>
                <LabelValue label="OUT" maxHeight="max-h-[60px]">
                    {toolUse.tool_result ? output : ''}
                </LabelValue>
            </Container>
        </ToolWrapper>
    )
}
