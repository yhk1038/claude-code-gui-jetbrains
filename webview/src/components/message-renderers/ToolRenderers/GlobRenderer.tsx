import {useState} from "react";
import {ToolUseBlockDto} from "@/types";
import {getAdapter} from "@/adapters";
import {useSessionContext} from "@/contexts/SessionContext";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";

class GlobToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        pattern: string;
    };
}

interface GlobToolResultDto {
    message?: {
        content: [{content: string}]
    };
    toolUseResult?: {
        filenames: string[];
        durationMs: number;
        numFiles: number;
        truncated: boolean;
    };
}

export function GlobRenderer(props: RendererProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const toolUse = props.toolUse as unknown as GlobToolUseDto;
    const toolResult = props.toolResult as GlobToolResultDto | undefined;

    const name = toolUse.name;
    const pattern = toolUse.input?.pattern ?? '';
    const content = toolResult?.message?.content[0]?.content ?? '' as string;
    // 구조화된 결과가 없으면 content에서 파일 경로를 파싱
    const filenames = toolResult?.toolUseResult?.filenames
        || (content ? content.split('\n').filter(line => line.trim()) : []);
    const numFiles = filenames.length;
    const { workingDirectory } = useSessionContext();

    const stripCwd = (filepath: string) => {
        if (workingDirectory && filepath.startsWith(workingDirectory)) {
            return filepath.slice(workingDirectory.length).replace(/^\//, '');
        }
        return filepath;
    };

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name}>
                <div className="text-white/80 text-[11px] line-clamp-2 font-mono">
                    pattern: "{pattern}"
                </div>
            </ToolHeader>

            {numFiles > 0 ? (
                <>
                    <div
                        className="text-white/50 text-[12px] mt-0.5 cursor-pointer hover:text-white/70 select-none"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        Found {numFiles} {numFiles === 1 ? 'file' : 'files'}
                    </div>

                    {isExpanded && (
                        <div className="mt-1 ml-0.5 text-[12px] font-mono">
                            {filenames.map((filename) => (
                                <div
                                    key={filename}
                                    className="text-white/50 hover:text-white/80 cursor-pointer truncate leading-[20px]"
                                    onClick={() => getAdapter().openFile(filename)}
                                >
                                    {stripCwd(filename)}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-white/50 text-[11px] whitespace-pre-wrap">
                    {content}
                </div>
            )}
        </ToolWrapper>
    )
}
