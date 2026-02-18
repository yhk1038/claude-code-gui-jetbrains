import {LoadedMessageDto, ToolUseBlockDto} from "@/types";
import {Container, LabelValue, ToolHeader, ToolWrapper} from "./common";
import {getAdapter} from "@/adapters";

class ReadToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        file_path: string;
    };
}

interface Props {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
}

export function ReadRenderer(props: Props) {
    const toolUse = props.toolUse as unknown as ReadToolUseDto;
    // const toolResult = props.toolResult as BashToolResultDto | undefined;

    const name = toolUse.name;
    const path = toolUse.input?.file_path ?? '';
    const fileName = path.split('/').reverse()[0];
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper>
            <ToolHeader name={name}>
                <div className="text-white/80 text-[12px] cursor-pointer hover:underline" onClick={() => getAdapter().openFile(path)}>{fileName}</div>
            </ToolHeader>
        </ToolWrapper>
    )
}
