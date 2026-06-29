import { parseXmlTag } from '@/utils/parseXmlTag';
import type { WorkflowNotification } from '@/dto/message/ContentBlockDto';

const NOTIFICATION_TAG = '<task-notification>';

/** Cheap check before the heavier parse. */
export function hasWorkflowNotification(text: string): boolean {
    return text.includes(NOTIFICATION_TAG);
}

function toInt(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a `<task-notification>` envelope into a {@link WorkflowNotification}.
 * Returns null when the text carries no notification. The `<usage>` sub-block is
 * parsed from its own slice so the inner numeric tags don't collide with any
 * same-named tags elsewhere in the message.
 */
export function parseWorkflowNotification(text: string): WorkflowNotification | null {
    if (!hasWorkflowNotification(text)) return null;
    const usage = parseXmlTag(text, 'usage') ?? '';
    return {
        taskId: parseXmlTag(text, 'task-id'),
        toolUseId: parseXmlTag(text, 'tool-use-id'),
        outputFile: parseXmlTag(text, 'output-file'),
        status: parseXmlTag(text, 'status'),
        summary: parseXmlTag(text, 'summary'),
        result: parseXmlTag(text, 'result'),
        usage: {
            agentCount: toInt(parseXmlTag(usage, 'agent_count')),
            subagentTokens: toInt(parseXmlTag(usage, 'subagent_tokens')),
            toolUses: toInt(parseXmlTag(usage, 'tool_uses')),
            durationMs: toInt(parseXmlTag(usage, 'duration_ms')),
        },
    };
}
