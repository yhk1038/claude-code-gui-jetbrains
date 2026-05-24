import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GetFileInfoRenderer } from '../GetFileInfoRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'get_file_info'): ToolUseBlockDto {
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

describe('GetFileInfoRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of file path', () => {
        render(<GetFileInfoRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        expect(screen.getByText('get_file_info')).toBeInTheDocument();
        expect(screen.getByText('foo.ts')).toBeInTheDocument();
    });

    it('opens file when basename is clicked', () => {
        render(<GetFileInfoRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        fireEvent.click(screen.getByText('foo.ts'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/foo.ts');
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<GetFileInfoRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"path"');
    });

    it('renders OUT box with raw text when toolResult is provided', () => {
        const text = 'size: 1024\nmodified: 2026-01-01T00:00:00Z\nisDirectory: false';
        render(
            <GetFileInfoRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts' })}
                toolResult={makeToolResult(text)}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        // whitespace-pre content — match via function to handle multi-line text nodes
        expect(screen.getByText((_, el) => el?.textContent === text)).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<GetFileInfoRenderer toolUse={makeToolUse({ path: '/a/b/foo.ts' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <GetFileInfoRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<GetFileInfoRenderer toolUse={makeToolUse({ path: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });

    it('does not render individual key-value rows (no table pattern)', () => {
        const text = 'size: 1024\nmodified: 2026-01-01T00:00:00Z\nisDirectory: false';
        render(
            <GetFileInfoRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts' })}
                toolResult={makeToolResult(text)}
            />
        );
        // raw output should be present as a single text block, not parsed into separate cells
        expect(screen.queryByText('size')).not.toBeInTheDocument();
        expect(screen.queryByText('1024')).not.toBeInTheDocument();
    });
});
