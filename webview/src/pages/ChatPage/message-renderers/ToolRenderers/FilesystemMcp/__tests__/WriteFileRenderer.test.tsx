import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WriteFileRenderer } from '../WriteFileRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'write_file'): ToolUseBlockDto {
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

describe('WriteFileRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of file path', () => {
        render(<WriteFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.txt', content: 'hello' })} />);
        expect(screen.getByText('write_file')).toBeInTheDocument();
        expect(screen.getByText('foo.txt')).toBeInTheDocument();
    });

    it('opens file when basename is clicked', () => {
        render(<WriteFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.txt', content: 'hello' })} />);
        fireEvent.click(screen.getByText('foo.txt'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/foo.txt');
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<WriteFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.txt', content: 'hello' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"content"');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <WriteFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.txt', content: 'hello' })}
                toolResult={makeToolResult('File written successfully')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('File written successfully')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<WriteFileRenderer toolUse={makeToolUse({ path: '/a/b/foo.txt', content: 'hello' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<WriteFileRenderer toolUse={makeToolUse({ path: '', content: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
