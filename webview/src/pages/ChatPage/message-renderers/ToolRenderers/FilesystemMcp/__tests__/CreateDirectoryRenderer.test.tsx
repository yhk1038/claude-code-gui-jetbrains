import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateDirectoryRenderer } from '../CreateDirectoryRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({
    getAdapter: () => ({ openFile: mockOpenFile }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'create_directory'): ToolUseBlockDto {
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

describe('CreateDirectoryRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of directory path', () => {
        render(<CreateDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/new-dir' })} />);
        expect(screen.getByText('create_directory')).toBeInTheDocument();
        expect(screen.getByText('new-dir')).toBeInTheDocument();
    });

    it('opens path when basename is clicked', () => {
        render(<CreateDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/new-dir' })} />);
        fireEvent.click(screen.getByText('new-dir'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/new-dir');
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<CreateDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/new-dir' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"path"');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <CreateDirectoryRenderer
                toolUse={makeToolUse({ path: '/a/b/new-dir' })}
                toolResult={makeToolResult('Successfully created directory /a/b/new-dir')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('Successfully created directory /a/b/new-dir')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<CreateDirectoryRenderer toolUse={makeToolUse({ path: '/a/b/new-dir' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <CreateDirectoryRenderer
                toolUse={makeToolUse({ path: '/a/b/new-dir' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<CreateDirectoryRenderer toolUse={makeToolUse({ path: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
