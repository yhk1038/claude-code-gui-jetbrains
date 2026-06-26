import {createContext, useContext} from "react";
import type {LoadedMessageDto} from "@/types";
import {ContentBlockType, ToolResultBlockDto} from "@/dto/message/ContentBlockDto";

/**
 * Lifecycle state of a tool call, used to color the leading bullet (●):
 *   - `success`  — a result arrived and is not an error    (green)
 *   - `error`    — the result is flagged is_error            (red)
 *   - `progress` — no result yet but the message is streaming (neutral, blinking)
 *   - `pending`  — no result and not streaming               (neutral, static)
 *
 * Mirrors the Cursor Claude Code extension's success/failure/progress states.
 */
export type ToolStatus = 'success' | 'error' | 'progress' | 'pending';

/** True when the tool_result block is flagged is_error. Never throws. */
export function toolResultIsError(toolResult?: LoadedMessageDto): boolean {
    const content = toolResult?.message?.content;
    if (!Array.isArray(content)) return false;
    const block = content[0];
    if (!block || block.type !== ContentBlockType.ToolResult) return false;
    return (block as ToolResultBlockDto).is_error === true;
}

/**
 * Derive the bullet status from a tool's result message and whether its parent
 * message is still streaming. A result, once present, wins regardless of the
 * streaming flag; with no result yet, a streaming message is in `progress`.
 */
export function toolStatus(toolResult?: LoadedMessageDto, isStreaming = false): ToolStatus {
    if (!toolResult) return isStreaming ? 'progress' : 'pending';
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
