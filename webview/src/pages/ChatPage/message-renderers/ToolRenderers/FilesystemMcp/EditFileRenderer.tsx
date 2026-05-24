import {ToolUseBlockDto} from "@/dto";
import {getAdapter} from "@/adapters";
import {cn} from "@/utils/cn";
import {RendererProps, ToolHeader, ToolWrapper} from "../common";
import {McpToolBody, McpToolRow} from "./_common";

class EditFileToolUseDto extends ToolUseBlockDto {
    declare input: {
        path: string;
        edits: Array<{ oldText: string; newText: string }>;
        dryRun?: boolean;
    };
}

export function EditFileRenderer(props: RendererProps) {
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as unknown as EditFileToolUseDto;
    const name = toolUse.name;
    const path = toolUse.input?.path ?? '';
    const fileName = path.split('/').reverse()[0];
    const dryRun = toolUse.input?.dryRun === true;
    const input = toolUse.input ?? {};

    const rawContent = toolResult?.message?.content?.[0];
    const outputText = (rawContent && typeof (rawContent as {content?: unknown}).content === 'string')
        ? (rawContent as {content: string}).content
        : '';

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                <div className="flex items-center gap-1.5">
                    <div
                        className={cn(
                            "text-text-link text-[0.9230rem] font-mono",
                            path && "cursor-pointer hover:underline"
                        )}
                        onClick={path ? () => getAdapter().openFile(path) : undefined}
                    >
                        {fileName}
                    </div>
                    {dryRun && (
                        <span className="text-text-secondary text-[0.8461rem]">(dry run)</span>
                    )}
                </div>
            </ToolHeader>

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
