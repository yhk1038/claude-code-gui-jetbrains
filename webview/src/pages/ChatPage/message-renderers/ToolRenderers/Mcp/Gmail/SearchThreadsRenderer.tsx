import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {RendererProps, ResultCaption, ToolHeader, ToolWrapper, toolResultText} from "../../common";
import {CollapsibleBox, McpToolBody, McpToolRow, formatMcpToolName} from "../_common";
import {GmailMailRow, isUnread, safeParseJson} from "./_shared";

class SearchThreadsToolUseDto extends ToolUseBlockDto {
    declare input: {
        query?: string;
        pageSize?: number;
        view?: string;
        pageToken?: string;
        includeTrash?: boolean;
    };
}

interface GmailMessage {
    date?: string;
    id?: string;
    labelIds?: string[];
    sender?: string;
    snippet?: string;
    subject?: string;
}

interface GmailThread {
    id?: string;
    messages?: GmailMessage[];
}

interface SearchThreadsResult {
    resultCountEstimate?: string;
    threads?: GmailThread[];
}

export function SearchThreadsRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as SearchThreadsToolUseDto;
    const name = formatMcpToolName(toolUse.name);
    const query = toolUse.input?.query ?? '';

    const outputText = toolResultText(toolResult);
    const parsed = safeParseJson<SearchThreadsResult>(outputText);
    const threads = Array.isArray(parsed?.threads) ? parsed.threads : undefined;
    const count = parsed?.resultCountEstimate;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                {query && (
                    <div className="truncate text-text-primary/80 text-[0.9230rem]">
                        {query}
                    </div>
                )}
            </ToolHeader>

            {count && <ResultCaption>{t('gmail.searchThreads.resultsFound', {count})}</ResultCaption>}

            {threads ? (
                <McpToolBody>
                    <CollapsibleBox collapsedMaxHeight={200}>
                        {threads.map((thread, i) => {
                            const msg = thread.messages?.[0] ?? {};
                            return (
                                <GmailMailRow
                                    key={thread.id ?? i}
                                    sender={msg.sender}
                                    subject={msg.subject}
                                    date={msg.date}
                                    snippet={msg.snippet}
                                    unread={isUnread(msg.labelIds)}
                                />
                            );
                        })}
                    </CollapsibleBox>
                </McpToolBody>
            ) : (
                outputText && (
                    <McpToolBody>
                        <McpToolRow label="OUT">{outputText}</McpToolRow>
                    </McpToolBody>
                )
            )}
        </ToolWrapper>
    );
}
