import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolHeader, ToolWrapper} from "../common";
import {McpToolBody, McpToolRow} from "./_common";

class ListAllowedDirectoriesToolUseDto extends ToolUseBlockDto {
    declare input: Record<string, never>;
}

export function ListAllowedDirectoriesRenderer(props: RendererProps) {
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as unknown as ListAllowedDirectoriesToolUseDto;
    const name = toolUse.name;
    const input = toolUse.input ?? {};

    const rawContent = toolResult?.message?.content?.[0];
    const outputText = (rawContent && typeof (rawContent as {content?: unknown}).content === 'string')
        ? (rawContent as {content: string}).content
        : '';

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name} />

            <McpToolBody>
                <McpToolRow label="IN">
                    {JSON.stringify(input, null, 2)}
                </McpToolRow>
                {outputText && (
                    <McpToolRow label="OUT">
                        {outputText}
                    </McpToolRow>
                )}
            </McpToolBody>
        </ToolWrapper>
    );
}
