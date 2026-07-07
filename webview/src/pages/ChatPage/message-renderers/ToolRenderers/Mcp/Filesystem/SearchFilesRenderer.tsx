import {ToolUseBlockDto} from "@/dto";
import {getAdapter} from "@/adapters";
import {cn} from "@/utils/cn";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper} from "../../common";
import {McpToolBody, McpToolRow} from "../_common";

class SearchFilesToolUseDto extends ToolUseBlockDto {
    declare input: {
        path: string;
        pattern: string;
        excludePatterns?: string[];
    };
}

export function SearchFilesRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as unknown as SearchFilesToolUseDto;
    const name = toolUse.name;
    const path = toolUse.input?.path ?? '';
    const dirName = path.split('/').filter(Boolean).pop() ?? path;
    const input = toolUse.input ?? {};

    const rawContent = toolResult?.message?.content?.[0];
    const outputText = (rawContent && typeof (rawContent as {content?: unknown}).content === 'string')
        ? (rawContent as {content: string}).content
        : '';

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                <div
                    dir="ltr"
                    className={cn(
                        "text-text-link text-[0.9230rem] font-mono",
                        path && "cursor-pointer hover:underline"
                    )}
                    onClick={path ? () => getAdapter().openFile(path) : undefined}
                >
                    {dirName || path || '/'}
                </div>
            </ToolHeader>

            <McpToolBody>
                <McpToolRow label={t('filesystem.common.in')}>
                    {JSON.stringify(input, null, 2)}
                </McpToolRow>
                {outputText && (
                    <McpToolRow label={t('filesystem.common.out')}>
                        {outputText}
                    </McpToolRow>
                )}
            </McpToolBody>
        </ToolWrapper>
    );
}
