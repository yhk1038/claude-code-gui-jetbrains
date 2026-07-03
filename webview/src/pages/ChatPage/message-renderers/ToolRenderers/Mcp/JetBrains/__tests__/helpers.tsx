import {ReactElement} from "react";
import {render} from "@testing-library/react";
import {ToolUseBlockDto, ContentBlockType} from "@/dto";
import type {LoadedMessageDto} from "@/types";
import {ToolStatusContext, type ToolStatus} from "../../../common";

export function makeToolUse(input: Record<string, unknown>, name: string): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name,
        input,
    });
}

export function makeToolResult(content: string, isError = false): LoadedMessageDto {
    return {
        message: {
            content: [{type: ContentBlockType.ToolResult, content, is_error: isError}],
        },
    } as unknown as LoadedMessageDto;
}

/**
 * Render inside a ToolStatusContext (defaults to 'success'), mirroring how
 * ToolRenderer injects status in production. Needed because file links are only
 * clickable when status === 'success'.
 */
export function renderWithStatus(ui: ReactElement, status: ToolStatus = 'success') {
    return render(<ToolStatusContext.Provider value={status}>{ui}</ToolStatusContext.Provider>);
}
