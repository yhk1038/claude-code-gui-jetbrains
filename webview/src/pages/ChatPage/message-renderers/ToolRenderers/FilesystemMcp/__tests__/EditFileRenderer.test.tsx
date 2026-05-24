import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditFileRenderer } from '../EditFileRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'edit_file'): ToolUseBlockDto {
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

describe('EditFileRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of file path', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts', edits: [] })}
            />
        );
        expect(screen.getByText('edit_file')).toBeInTheDocument();
        expect(screen.getByText('foo.ts')).toBeInTheDocument();
    });

    it('opens file when basename is clicked', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts', edits: [] })}
            />
        );
        fireEvent.click(screen.getByText('foo.ts'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/foo.ts');
    });

    it('renders IN box with JSON-stringified input including edits', () => {
        const input = {
            path: '/a/b/foo.ts',
            edits: [{ oldText: 'foo', newText: 'bar' }],
        };
        render(<EditFileRenderer toolUse={makeToolUse(input)} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"edits"');
    });

    it('renders OUT box when toolResult is provided', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts', edits: [] })}
                toolResult={makeToolResult('Edit applied successfully')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('Edit applied successfully')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({ path: '/a/b/foo.ts', edits: [] })}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('shows dry run label when dryRun is true', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({
                    path: '/a/b/foo.ts',
                    edits: [{ oldText: 'foo', newText: 'bar' }],
                    dryRun: true,
                })}
            />
        );
        expect(screen.getByText(/dry run/)).toBeInTheDocument();
    });

    it('does not show dry run label when dryRun is false', () => {
        render(
            <EditFileRenderer
                toolUse={makeToolUse({
                    path: '/a/b/foo.ts',
                    edits: [],
                    dryRun: false,
                })}
            />
        );
        expect(screen.queryByText(/dry run/)).not.toBeInTheDocument();
    });
});
