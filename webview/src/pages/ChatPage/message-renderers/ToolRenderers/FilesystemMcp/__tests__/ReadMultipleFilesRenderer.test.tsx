import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadMultipleFilesRenderer } from '../ReadMultipleFilesRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

vi.mock('@/adapters', () => ({
    getAdapter: () => ({ openFile: vi.fn() }),
}));

function makeToolUse(paths: string[]): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name: 'read_multiple_files',
        input: { paths },
    });
}

function makeToolResult(content: string): LoadedMessageDto {
    return {
        message: {
            content: [{ type: ContentBlockType.ToolResult, content }],
        },
    } as unknown as LoadedMessageDto;
}

describe('ReadMultipleFilesRenderer', () => {
    it('renders tool name and file count in header', () => {
        render(<ReadMultipleFilesRenderer toolUse={makeToolUse(['/a/foo.ts', '/a/bar.ts'])} />);
        expect(screen.getByText('read_multiple_files')).toBeInTheDocument();
        expect(screen.getByText('2 files')).toBeInTheDocument();
    });

    it('renders IN box with JSON-stringified paths array', () => {
        render(<ReadMultipleFilesRenderer toolUse={makeToolUse(['/a/foo.ts', '/a/bar.ts'])} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"paths\"/);
        expect(inContent.textContent).toContain('/a/foo.ts');
        expect(inContent.textContent).toContain('/a/bar.ts');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <ReadMultipleFilesRenderer
                toolUse={makeToolUse(['/a/foo.ts'])}
                toolResult={makeToolResult('file contents here')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('file contents here')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<ReadMultipleFilesRenderer toolUse={makeToolUse(['/a/foo.ts'])} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <ReadMultipleFilesRenderer
                toolUse={makeToolUse(['/a/foo.ts'])}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('handles empty paths array — shows 0 files', () => {
        render(<ReadMultipleFilesRenderer toolUse={makeToolUse([])} />);
        expect(screen.getByText('0 files')).toBeInTheDocument();
    });
});
