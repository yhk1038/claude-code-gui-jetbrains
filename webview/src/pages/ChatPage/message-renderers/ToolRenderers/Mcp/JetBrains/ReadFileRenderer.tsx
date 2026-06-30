import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolWrapper, toolResultText, toolResultIsError, Container, LabelValue} from "../../common";
import {JetBrainsToolHeader, JetBrainsResultError, inputProjectPath} from "./_shared";

class ReadFileToolUseDto extends ToolUseBlockDto {
    declare input: {file_path: string; offset?: number; limit?: number};
}

/** `read_file`: clickable file link + numbered-line content (collapsible). */
export function ReadFileRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as ReadFileToolUseDto;
    const input = (toolUse.input ?? {}) as Record<string, unknown>;
    const path = toolUse.input?.file_path ?? '';
    const out = toolResultText(props.toolResult);
    const isError = toolResultIsError(props.toolResult);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <JetBrainsToolHeader name={toolUse.name} path={path} projectPath={inputProjectPath(input)} input={input} />
            {isError ? (
                <JetBrainsResultError toolResult={props.toolResult} />
            ) : (
                out && (
                    <Container className="mt-1.5">
                        <LabelValue maxHeight="max-h-[160px]">{out}</LabelValue>
                    </Container>
                )
            )}
        </ToolWrapper>
    );
}
