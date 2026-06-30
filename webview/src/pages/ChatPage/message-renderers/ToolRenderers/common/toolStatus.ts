import {createContext, useContext} from "react";
import type {LoadedMessageDto} from "@/types";
import {ContentBlockType, ToolResultBlockDto} from "@/dto/message/ContentBlockDto";
import {USER_DECLINED_PREFIX} from "@/shared";

/**
 * Lifecycle state of a tool call, used to color the leading bullet (●):
 *   - `success`  — a result arrived and is not an error    (green)
 *   - `error`    — the result is flagged is_error            (red)
 *   - `declined` — the user denied the tool (a decision, not a failure) (muted)
 *   - `progress` — no result yet but the message is streaming (neutral, blinking)
 *   - `pending`  — no result and not streaming               (neutral, static)
 *
 * Mirrors the Cursor Claude Code extension's success/failure/progress states.
 */
export type ToolStatus = 'success' | 'error' | 'declined' | 'progress' | 'pending';

/** The first content block of a tool_result message, or undefined. */
function firstToolResultBlock(toolResult?: LoadedMessageDto): ToolResultBlockDto | undefined {
    const content = toolResult?.message?.content;
    if (!Array.isArray(content)) return undefined;
    const block = content[0];
    if (!block || block.type !== ContentBlockType.ToolResult) return undefined;
    return block as ToolResultBlockDto;
}

/** True when the tool_result block is flagged is_error. Never throws. */
export function toolResultIsError(toolResult?: LoadedMessageDto): boolean {
    return firstToolResultBlock(toolResult)?.is_error === true;
}

/**
 * True when this result is a user's denial decision (not a tool/server failure).
 * The marker is set by the backend on denied permissions and persists in the
 * content, so it is recognized live and after a reload.
 */
export function isUserDeclined(toolResult?: LoadedMessageDto): boolean {
    const content = firstToolResultBlock(toolResult)?.content;
    return typeof content === 'string' && content.startsWith(USER_DECLINED_PREFIX);
}

/**
 * Derive the bullet status from a tool's result message and whether its parent
 * message is still streaming. A result, once present, wins regardless of the
 * streaming flag; with no result yet, a streaming message is in `progress`.
 * A user decline is reported as `declined` (it isn't a failure).
 */
export function toolStatus(toolResult?: LoadedMessageDto, isStreaming = false): ToolStatus {
    if (!toolResult) return isStreaming ? 'progress' : 'pending';
    if (isUserDeclined(toolResult)) return 'declined';
    return toolResultIsError(toolResult) ? 'error' : 'success';
}

/**
 * Carries the current tool's status down to ToolWrapper without threading a
 * prop through every renderer. ToolRenderer provides it; ToolWrapper consumes
 * it. Defaults to `pending` so ToolWrapper renders correctly with no provider.
 */
export const ToolStatusContext = createContext<ToolStatus>('pending');

export function useToolStatus(): ToolStatus {
    return useContext(ToolStatusContext);
}
