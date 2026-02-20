import {ToolUseBlockDto} from "@/types";
import {getAdapter} from "@/adapters";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";

class EditToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        file_path: string;
        old_string: string;
        new_string: string;
    };
}

function summarizeDiff(oldStr: string, newStr: string): string {
    const oldLines = oldStr ? oldStr.split('\n').length : 0;
    const newLines = newStr ? newStr.split('\n').length : 0;
    const added = Math.max(0, newLines - oldLines);
    const removed = Math.max(0, oldLines - newLines);

    const parts: string[] = [];
    if (added > 0) parts.push(`Added ${added} line${added > 1 ? 's' : ''}`);
    if (removed > 0) parts.push(`Removed ${removed} line${removed > 1 ? 's' : ''}`);
    if (parts.length === 0) parts.push(`Changed ${oldLines} line${oldLines > 1 ? 's' : ''}`);
    return parts.join(', ');
}

export function EditRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as EditToolUseDto;
    const name = toolUse.name;
    const path = toolUse.input?.file_path ?? '';
    const fileName = path.split('/').reverse()[0];
    const oldString = toolUse.input?.old_string ?? '';
    const newString = toolUse.input?.new_string ?? '';
    const summary = summarizeDiff(oldString, newString);

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} className="mb-[2px]" inProgress={!props.toolResult}>
                <div className="text-white/80 text-[11px] cursor-pointer hover:underline font-mono" onClick={() => getAdapter().openFile(path)}>{fileName}</div>
            </ToolHeader>
            <div className="text-white/50 text-[11px]">{summary}</div>
        </ToolWrapper>
    )
}
