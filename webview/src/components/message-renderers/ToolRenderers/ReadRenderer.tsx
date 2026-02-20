import {getAdapter} from "@/adapters";
import {ToolUseBlockDto} from "@/types";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";

class ReadToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        file_path: string;
    };
}

export function ReadRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as ReadToolUseDto;
    // const toolResult = props.toolResult as BashToolResultDto | undefined;

    const name = toolUse.name;
    const path = toolUse.input?.file_path ?? '';
    const fileName = path.split('/').reverse()[0];
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                <div className="text-white/80 text-[12px] cursor-pointer hover:underline font-mono" onClick={() => getAdapter().openFile(path)}>{fileName}</div>
            </ToolHeader>
        </ToolWrapper>
    )
}
