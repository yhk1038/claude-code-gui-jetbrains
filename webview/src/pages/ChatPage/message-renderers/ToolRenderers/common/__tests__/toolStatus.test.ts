import {describe, it, expect} from 'vitest';
import {ContentBlockType} from '@/dto';
import type {LoadedMessageDto} from '@/types';
import {toolResultIsError, toolStatus} from '../toolStatus';

function makeToolResult(content: string, isError?: boolean): LoadedMessageDto {
    return {
        message: {
            content: [{type: ContentBlockType.ToolResult, content, is_error: isError}],
        },
    } as unknown as LoadedMessageDto;
}

describe('toolResultIsError', () => {
    it('is false when there is no result yet', () => {
        expect(toolResultIsError(undefined)).toBe(false);
    });

    it('is false for a normal (non-error) result', () => {
        expect(toolResultIsError(makeToolResult('Found 3 messages'))).toBe(false);
    });

    it('is true when the tool_result block is flagged is_error', () => {
        expect(toolResultIsError(makeToolResult('ACTION REQUIRED', true))).toBe(true);
    });

    it('is false when the first block is not a tool_result', () => {
        const msg = {
            message: {content: [{type: ContentBlockType.Text, text: 'hi'}]},
        } as unknown as LoadedMessageDto;
        expect(toolResultIsError(msg)).toBe(false);
    });
});

describe('toolStatus', () => {
    it('is pending when no result has arrived and not streaming', () => {
        expect(toolStatus(undefined)).toBe('pending');
        expect(toolStatus(undefined, false)).toBe('pending');
    });

    it('is progress when no result yet but the message is streaming', () => {
        expect(toolStatus(undefined, true)).toBe('progress');
    });

    it('is success for a completed non-error result (streaming flag ignored)', () => {
        expect(toolStatus(makeToolResult('ok'))).toBe('success');
        expect(toolStatus(makeToolResult('ok'), true)).toBe('success');
    });

    it('is error for an is_error result', () => {
        expect(toolStatus(makeToolResult('boom', true))).toBe('error');
    });
});
