import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadFileRenderer } from '../ReadFileRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'read_file'): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name,
        input,
    });
}

function makeToolResult(content: string): LoadedMessageDto {
    return {
        message: {
            content: [{ type: ContentBlockType.ToolResult, content }],
        },
    } as unknown as LoadedMessageDto;
}

describe('ReadFileRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of file path', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        expect(screen.getByText('read_file')).toBeInTheDocument();
        expect(screen.getByText('foo.ts')).toBeInTheDocument();
    });

    it('opens file when basename is clicked', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        fireEvent.click(screen.getByText('foo.ts'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/foo.ts');
    });

    it('works with read_text_file name', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' }, 'read_text_file')} />);
        expect(screen.getByText('read_text_file')).toBeInTheDocument();
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts', head: 10 })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"head": 10');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <ReadFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts' })}
                toolResult={makeToolResult('hello world')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('hello world')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <ReadFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<ReadFileRenderer toolUse={makeToolUse({ path: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
