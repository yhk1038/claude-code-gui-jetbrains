import {useState} from "react";
import {ToolUseBlockDto} from "@/types";
import {getAdapter} from "@/adapters";
import {useTranslation} from "@/i18n";
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
    const {t} = useTranslation('chatTools');
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
                <div dir="ltr" className="text-text-primary/80 text-[0.8461rem] line-clamp-2 font-mono">
                    {t('glob.pattern', {pattern})}
                </div>
            </ToolHeader>

            {numFiles > 0 ? (
                <>
                    <div
                        className="text-text-primary/50 text-[0.9230rem] mt-0.5 cursor-pointer hover:text-text-primary/70 select-none"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {t('glob.foundFiles', {count: numFiles})}
                    </div>

                    {isExpanded && (
                        <div dir="ltr" className="mt-1 ms-0.5 text-[0.9230rem] font-mono">
                            {filenames.map((filename) => (
                                <div
                                    key={filename}
                                    className="text-text-primary/50 hover:text-text-primary/80 cursor-pointer truncate leading-[20px]"
                                    onClick={() => getAdapter().openFile(filename)}
                                >
                                    {stripCwd(filename)}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-text-primary/50 text-[0.8461rem] whitespace-pre-wrap">
                    {content}
                </div>
            )}
        </ToolWrapper>
    )
}
