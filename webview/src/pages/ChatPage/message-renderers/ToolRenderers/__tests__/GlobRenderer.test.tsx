import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {GlobRenderer} from '../GlobRenderer';
import {ToolUseBlockDto, ContentBlockType} from '@/dto';
import type {LoadedMessageDto} from '@/types';

vi.mock('@/adapters', () => ({
    getAdapter: () => ({openFile: vi.fn()}),
}));

vi.mock('@/contexts/SessionContext', () => ({
    useSessionContext: () => ({workingDirectory: '/repo'}),
}));

function makeToolUse(input: Record<string, unknown>): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name: 'Glob',
        input,
    });
}

function makeToolResult(filenames: string[]): LoadedMessageDto {
    return {
        message: {content: [{type: ContentBlockType.ToolResult, content: filenames.join('\n')}]},
        toolUseResult: {filenames, durationMs: 1, numFiles: filenames.length, truncated: false},
    } as unknown as LoadedMessageDto;
}

// RTL exception: the search pattern and the expanded file list are code/path
// content and must stay LTR regardless of <html dir="rtl"> UI mirroring.
describe('GlobRenderer — RTL exception (pattern/file list content stays LTR)', () => {
    it('renders the pattern with dir="ltr"', () => {
        render(<GlobRenderer toolUse={makeToolUse({pattern: '**/*.ts'})} />);
        const el = screen.getByText(/\*\*\/\*\.ts/).closest('div[dir]');
        expect(el).toHaveAttribute('dir', 'ltr');
    });

    it('renders the expanded file list with dir="ltr"', () => {
        render(
            <GlobRenderer
                toolUse={makeToolUse({pattern: '**/*.ts'})}
                toolResult={makeToolResult(['/repo/src/foo.ts', '/repo/src/bar.ts'])}
            />,
        );
        fireEvent.click(screen.getByText(/found/i));
        const el = screen.getByText('src/foo.ts').closest('div[dir]');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});
