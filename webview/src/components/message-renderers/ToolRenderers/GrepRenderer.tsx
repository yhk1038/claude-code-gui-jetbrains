import {LoadedMessageDto, ToolUseBlockDto} from "@/types";
import {Container, LabelValue, ToolHeader, ToolWrapper} from "./common";
import {getAdapter} from "@/adapters";
import {useState} from "react";

class GrepToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        path: string;
        pattern: string;
    };
}

class GrepToolResultDto {
    type: string;
    tool_use_id: string;
    content: string;
}

interface Props {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
}

export function GrepRenderer(props: Props) {
    const [isExpanded, setIsExpanded] = useState(false);
    const toolUse = props.toolUse as unknown as GrepToolUseDto;
    const toolResult = props.toolResult?.message?.content[0] as GrepToolResultDto | undefined;

    const name = toolUse.name;
    const path = toolUse.input?.path ?? '';
    const pattern = toolUse.input?.pattern ?? '';
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper>
            <ToolHeader name={name}>
                <div className="text-white/80 text-[12px] line-clamp-2">"{pattern}" (in {path})</div>
            </ToolHeader>

            {toolResult?.content && <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-white/50 text-[11px] cursor-pointer hover:underline whitespace-pre-wrap ${isExpanded ? '' : 'max-h-[20px] overflow-hidden'}`}>
                    {toolResult.content}
                </div>
            }
        </ToolWrapper>
    )
}
