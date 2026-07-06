import {useState} from "react";
import {ToolUseBlockDto} from "@/types";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper, toolResultText} from "./common";

class GrepToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        path: string;
        pattern: string;
    } | {
        pattern: string;
        glob: string;
        output_mode: string;
        head_limit: number;
    };
}

export function GrepRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const [isExpanded, setIsExpanded] = useState(false);
    const toolUse = props.toolUse as unknown as GrepToolUseDto;
    const output = toolResultText(props.toolResult);

    const name = toolUse.name;
    const pattern = toolUse.input?.pattern ?? '';

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} className="mb-2.5">
                <div className="text-text-primary/80 text-[0.9230rem] line-clamp-2 break-all">
                    "{pattern}"{` `}
                    {toolUse.input && 'path' in toolUse.input && t('grep.inPath', {path: toolUse.input.path})}
                    {toolUse.input && 'glob' in toolUse.input && t('grep.globPattern', {glob: toolUse.input.glob})}
                </div>
            </ToolHeader>

            {output && (
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`text-text-primary/50 text-[0.8461rem] -mt-1 cursor-pointer hover:underline whitespace-pre-wrap ${isExpanded ? '' : 'max-h-[20px] overflow-hidden'}`}>
                    {output}
                </div>
            )}
        </ToolWrapper>
    )
}
