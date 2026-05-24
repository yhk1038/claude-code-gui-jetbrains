import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListDirectoryRenderer } from '../ListDirectoryRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'list_directory'): ToolUseBlockDto {
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

describe('ListDirectoryRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of directory path', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/src' })} />);
        expect(screen.getByText('list_directory')).toBeInTheDocument();
        expect(screen.getByText('src')).toBeInTheDocument();
    });

    it('opens directory when basename is clicked', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/src' })} />);
        fireEvent.click(screen.getByText('src'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/src');
    });

    it('supports list_directory_with_sizes alias', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '/a/b' }, 'list_directory_with_sizes')} />);
        expect(screen.getByText('list_directory_with_sizes')).toBeInTheDocument();
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/src', sortBy: 'size' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"sortBy": "size"');
    });

    it('renders OUT box with raw listing text when toolResult is provided', () => {
        const listing = '[DIR] src\n[FILE] readme.md\n[FILE] index.ts (1.2 KB)';
        render(
            <ListDirectoryRenderer
                toolUse={makeToolUse({ path: '/a/b' })}
                toolResult={makeToolResult(listing)}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        // whitespace-pre preserves newlines; match by textContent function
        expect(screen.getByText((_, el) => el?.textContent === listing)).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '/a/b' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <ListDirectoryRenderer
                toolUse={makeToolUse({ path: '/a/b' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<ListDirectoryRenderer toolUse={makeToolUse({ path: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
