import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveFileRenderer } from '../MoveFileRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({
    getAdapter: () => ({ openFile: mockOpenFile }),
}));

function makeToolUse(input: Record<string, unknown>): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name: 'move_file',
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

describe('MoveFileRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('shows source -> destination basenames', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/b/foo.ts', destination: '/x/y/bar.ts' })} />);
        expect(screen.getByText('foo.ts')).toBeInTheDocument();
        expect(screen.getByText('bar.ts')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('renders tool name in header', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })} />);
        expect(screen.getByText('move_file')).toBeInTheDocument();
    });

    it('opens source file on source click', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })} />);
        fireEvent.click(screen.getByText('foo.ts'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/foo.ts');
    });

    it('opens destination file on destination click', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })} />);
        fireEvent.click(screen.getByText('bar.ts'));
        expect(mockOpenFile).toHaveBeenCalledWith('/x/bar.ts');
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"source\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"destination"');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <MoveFileRenderer
                toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })}
                toolResult={makeToolResult('moved successfully')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('moved successfully')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <MoveFileRenderer
                toolUse={makeToolUse({ source: '/a/foo.ts', destination: '/x/bar.ts' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not attach click handler when paths are empty', () => {
        render(<MoveFileRenderer toolUse={makeToolUse({ source: '', destination: '' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
