import {LoadedMessageDto, ToolUseBlockDto} from "@/types";
import {Container, LabelValue, ToolHeader, ToolWrapper} from "./common";
import {getAdapter} from "@/adapters";
import {useState} from "react";
import {useSessionContext} from "@/contexts/SessionContext";

class GlobToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        pattern: string;
    };
}

class GlobToolResultDto extends LoadedMessageDto {
    declare message: {
        content: [{content: string}]
    }
    declare toolUseResult: {
        filenames: string[];
        durationMs: number;
        numFiles: number;
        truncated: boolean;
    }
}

interface Props {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
}

export function GlobRenderer(props: Props) {
    const [isExpanded, setIsExpanded] = useState(false);
    const toolUse = props.toolUse as unknown as GlobToolUseDto;
    const toolResult = props.toolResult as GlobToolResultDto | undefined;

    const name = toolUse.name;
    const pattern = toolUse.input?.pattern ?? '';
    const content = toolResult?.message?.content[0]?.content ?? '' as string;
    const filenames = toolResult?.toolUseResult?.filenames || [];
    const { workingDirectory } = useSessionContext();

    const stripCwd = (filepath: string) => {
        if (workingDirectory && filepath.startsWith(workingDirectory)) {
            return filepath.slice(workingDirectory.length).replace(/^\//, '');
        }
        return filepath;
    };

    return (
        <ToolWrapper>
            <ToolHeader name={name}>
                <div className="text-white/80 text-[11px] line-clamp-2 font-mono">
                    pattern: "{pattern}"
                </div>
            </ToolHeader>

            {filenames.length ? (
                <div
                    className={`text-white/50 text-[11px] whitespace-pre-wrap`}>
                    <div className="cursor-pointer hover:underline" onClick={() => setIsExpanded(!isExpanded)}>
                        Found {filenames.length} files
                    </div>

                    <ul className={`${isExpanded ? '' : 'hidden'}`}>
                        {filenames.map((filename) => (
                            <li
                                key={filename}
                                className="cursor-pointer hover:underline truncate"
                                onClick={() => getAdapter().openFile(filename)}
                            >{stripCwd(filename)}</li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div
                    className={`text-white/50 text-[11px] whitespace-pre-wrap`}>
                    {content}
                </div>
            )}
        </ToolWrapper>
    )
}
