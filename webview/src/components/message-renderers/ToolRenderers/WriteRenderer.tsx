import {ToolUseBlockDto} from "@/dto";
import {getAdapter} from "@/adapters";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";

class WriteToolUseDto extends ToolUseBlockDto {
    declare input: {
        file_path: string;
        content: string;
    };
}

export function WriteRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as WriteToolUseDto;
    const filePath = toolUse.input?.file_path ?? '';
    const fileName = filePath.split('/').pop() ?? filePath;
    const lineCount = (toolUse.input?.content ?? '').split('\n').length;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="Write" inProgress={!props.toolResult}>
                <div className="text-white/80 text-[11px] cursor-pointer hover:underline font-mono" onClick={() => getAdapter().openFile(filePath)}>{fileName}</div>
            </ToolHeader>
            <div className="text-white/50 text-[11px]">{lineCount} lines</div>
        </ToolWrapper>
    );
}
