import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper, toolResultText} from "../../common";
import {McpToolBody, McpToolRow, formatMcpToolName} from "../_common";
import {GmailMailRow, isUnread, safeParseJson} from "./_shared";

class ListDraftsToolUseDto extends ToolUseBlockDto {
    declare input: {
        query?: string;
        pageSize?: number;
        view?: string;
        pageToken?: string;
    };
}

interface GmailDraftMessage {
    subject?: string;
    snippet?: string;
    sender?: string;
    date?: string;
    labelIds?: string[];
}

interface GmailDraft {
    id?: string;
    message?: GmailDraftMessage;
}

interface ListDraftsResult {
    drafts?: GmailDraft[];
}

export function ListDraftsRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as ListDraftsToolUseDto;
    const name = formatMcpToolName(toolUse.name);

    const outputText = toolResultText(toolResult);
    const parsed = safeParseJson<ListDraftsResult>(outputText);
    const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts : undefined;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader
                name={name}
                description={drafts ? t('gmail.listDrafts.count', {count: drafts.length}) : ''}
            />

            {drafts ? (
                <McpToolBody>
                    {drafts.map((draft, i) => {
                        const msg = draft.message ?? {};
                        return (
                            <GmailMailRow
                                key={draft.id ?? i}
                                sender={msg.sender}
                                subject={msg.subject}
                                date={msg.date}
                                snippet={msg.snippet}
                                unread={isUnread(msg.labelIds)}
                            />
                        );
                    })}
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
