import {ToolUseBlockDto} from "@/dto";
import {getAdapter} from "@/adapters";
import {cn} from "@/utils/cn";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper} from "../../common";
import {McpToolBody, McpToolRow} from "../_common";

class MoveFileToolUseDto extends ToolUseBlockDto {
    declare input: {
        source: string;
        destination: string;
    };
}

export function MoveFileRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as unknown as MoveFileToolUseDto;
    const name = toolUse.name;
    const source = toolUse.input?.source ?? '';
    const destination = toolUse.input?.destination ?? '';
    const sourceName = source.split('/').pop() ?? source;
    const destName = destination.split('/').pop() ?? destination;
    const input = toolUse.input ?? {};

    const rawContent = toolResult?.message?.content?.[0];
    const outputText = (rawContent && typeof (rawContent as {content?: unknown}).content === 'string')
        ? (rawContent as {content: string}).content
        : '';

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                <div dir="ltr" className="flex items-center gap-1.5 text-[0.9230rem] font-mono">
                    <span
                        className={cn("text-text-link", source && "cursor-pointer hover:underline")}
                        onClick={source ? () => getAdapter().openFile(source) : undefined}
                    >{sourceName}</span>
                    <span className="text-text-primary/40">→</span>
                    <span
                        className={cn("text-text-link", destination && "cursor-pointer hover:underline")}
                        onClick={destination ? () => getAdapter().openFile(destination) : undefined}
                    >{destName}</span>
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
