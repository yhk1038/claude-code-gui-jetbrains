import {describe, it, expect} from 'vitest';
import {buildUserDeclinedContent, parseUserDeclined, USER_DECLINED_PREFIX} from '@/shared';
import type {LoadedMessageDto} from '@/types';
import {ContentBlockType} from '@/dto/message/ContentBlockDto';
import {toolStatus, isUserDeclined, toolResultIsError} from '../../../common';
import {makeToolResult} from './helpers';

/**
 * A reloaded tool_result whose content is a text-block ARRAY rather than a bare
 * string — how the CLI can re-serialize a persisted result. The decline marker
 * must still be recognized after this round-trip.
 */
function makeReloadedToolResult(text: string, isError = false): LoadedMessageDto {
    return {
        message: {
            content: [{
                type: ContentBlockType.ToolResult,
                content: [{type: ContentBlockType.Text, text}],
                is_error: isError,
            }],
        },
    } as unknown as LoadedMessageDto;
}

describe('user-decline marker (shared)', () => {
    it('round-trips a decline with an instruction', () => {
        const content = buildUserDeclinedContent('use run to line 10');
        expect(content.startsWith(USER_DECLINED_PREFIX)).toBe(true);
        expect(parseUserDeclined(content)).toEqual({instruction: 'use run to line 10'});
    });

    it('round-trips a decline without a reason', () => {
        const content = buildUserDeclinedContent();
        expect(content).toBe(USER_DECLINED_PREFIX);
        expect(parseUserDeclined(content)).toEqual({instruction: ''});
    });

    it('returns null for a non-decline content', () => {
        expect(parseUserDeclined('MCP server "idea" is not connected')).toBeNull();
        expect(parseUserDeclined(undefined)).toBeNull();
    });
});

describe('toolStatus / isUserDeclined', () => {
    it('reports a denied tool as declined (not error)', () => {
        const denied = makeToolResult(buildUserDeclinedContent('do X instead'), true);
        expect(isUserDeclined(denied)).toBe(true);
        expect(toolStatus(denied)).toBe('declined');
    });

    it('still reports a real failure as error', () => {
        const failed = makeToolResult('MCP server "idea" is not connected', true);
        expect(isUserDeclined(failed)).toBe(false);
        expect(toolResultIsError(failed)).toBe(true);
        expect(toolStatus(failed)).toBe('error');
    });

    it('reports a normal result as success', () => {
        expect(toolStatus(makeToolResult('ok'))).toBe('success');
    });

    it('recognizes a decline after reload as a text-block array (not just a string)', () => {
        const reloaded = makeReloadedToolResult(buildUserDeclinedContent('do X instead'), true);
        expect(isUserDeclined(reloaded)).toBe(true);
        expect(toolStatus(reloaded)).toBe('declined');
    });

    it('a real failure serialized as a text-block array stays error', () => {
        const failed = makeReloadedToolResult('MCP server "idea" is not connected', true);
        expect(isUserDeclined(failed)).toBe(false);
        expect(toolStatus(failed)).toBe('error');
    });
});
