import {ToolUseBlockDto} from "@/dto";
import {i18n} from "@/i18n";
import {RendererProps, ToolHeader, ToolWrapper, toolResultText} from "../../common";
import {McpToolBody, McpToolRow, formatMcpToolName} from "../_common";

/**
 * Builds the header description for a Gmail action tool from its input.
 * Each entry maps a tool name to a function that turns the (untyped) input into
 * a concise, human-readable summary. Original field names are read as-is.
 * These functions run outside any React hook context, so they use the global
 * i18n instance directly rather than the useTranslation hook.
 */
export type ActionDescriptionFn = (input: Record<string, unknown>) => string;

function labelCount(input: Record<string, unknown>): number {
    const ids = input.labelIds;
    return Array.isArray(ids) ? ids.length : 0;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

/**
 * Sensitive-label tools add a Trash/Spam label to a message or thread. The
 * concrete label is carried in labelOption ('TRASH' | 'SPAM'); any other value
 * falls back to a neutral phrasing so the card never shows an empty header.
 */
function sensitiveAction(target: 'message' | 'thread'): ActionDescriptionFn {
    return (input) => {
        const option = asString(input.labelOption);
        const targetLabel = target === 'message'
            ? i18n.t('chatTools:gmail.action.targetMessage')
            : i18n.t('chatTools:gmail.action.targetThread');
        if (option === 'TRASH') return i18n.t('chatTools:gmail.action.moveToTrash', {target: targetLabel});
        if (option === 'SPAM') return i18n.t('chatTools:gmail.action.markAsSpam', {target: targetLabel});
        return i18n.t('chatTools:gmail.action.applySensitiveLabel', {target: targetLabel});
    };
}

export const GmailActionDescriptions: Record<string, ActionDescriptionFn> = {
    label_thread: (input) => i18n.t('chatTools:gmail.action.addLabelsToThread', {count: labelCount(input)}),
    unlabel_thread: (input) => i18n.t('chatTools:gmail.action.removeLabelsFromThread', {count: labelCount(input)}),
    label_message: (input) => i18n.t('chatTools:gmail.action.addLabelsToMessage', {count: labelCount(input)}),
    unlabel_message: (input) => i18n.t('chatTools:gmail.action.removeLabelsFromMessage', {count: labelCount(input)}),
    create_label: (input) => {
        const name = asString(input.name);
        return name ? i18n.t('chatTools:gmail.action.createLabelNamed', {name}) : i18n.t('chatTools:gmail.action.createLabel');
    },
    update_label: (input) => {
        const name = asString(input.name);
        return name ? i18n.t('chatTools:gmail.action.updateLabelNamed', {name}) : i18n.t('chatTools:gmail.action.updateLabel');
    },
    delete_label: () => i18n.t('chatTools:gmail.action.deleteLabel'),
    apply_sensitive_message_label: sensitiveAction('message'),
    apply_sensitive_thread_label: sensitiveAction('thread'),
};

/**
 * Generic renderer for Gmail "action" tools (label/unlabel/create/update/delete).
 * Shows a meaningful header description derived from the input plus the
 * standard IN/OUT body. The concrete description is resolved by tool name from
 * GmailActionDescriptions.
 */
export function GmailActionRenderer(props: RendererProps) {
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as ToolUseBlockDto;
    const name = formatMcpToolName(toolUse.name);
    const input = toolUse.input ?? {};

    const shortName = toolUse.name.split('__').pop() ?? toolUse.name;
    const describe = GmailActionDescriptions[shortName];
    const description = describe ? describe(input) : '';

    const outputText = toolResultText(toolResult);

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name} description={description} />

            <McpToolBody>
                <McpToolRow label="IN">
                    {JSON.stringify(input, null, 2)}
                </McpToolRow>
                {outputText && (
                    <McpToolRow label="OUT">
                        {outputText}
                    </McpToolRow>
                )}
            </McpToolBody>
        </ToolWrapper>
    );
}
