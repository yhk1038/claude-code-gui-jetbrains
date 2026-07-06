import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper} from "../../common";
import {McpToolBody, McpToolRow} from "../_common";

class ListAllowedDirectoriesToolUseDto extends ToolUseBlockDto {
    declare input: Record<string, never>;
}

export function ListAllowedDirectoriesRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
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
