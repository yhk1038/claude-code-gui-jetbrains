import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchFilesRenderer } from '../SearchFilesRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(input: Record<string, unknown>, name = 'search_files'): ToolUseBlockDto {
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

describe('SearchFilesRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name in header', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })} />);
        expect(screen.getByText('search_files')).toBeInTheDocument();
    });

    it('renders basename of path as text-text-link in header', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })} />);
        expect(screen.getByText('src')).toBeInTheDocument();
    });

    it('opens directory when basename is clicked', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })} />);
        fireEvent.click(screen.getByText('src'));
        expect(mockOpenFile).toHaveBeenCalledWith('/repo/src');
    });

    it('does not attach click handler when path is empty', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '', pattern: '*.ts' })} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });

    it('renders IN label with JSON-stringified input including path and pattern', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent.textContent).toContain('"pattern"');
        expect(inContent.textContent).toContain('*.ts');
    });

    it('renders IN box including excludePatterns when present', () => {
        render(
            <SearchFilesRenderer
                toolUse={makeToolUse({ path: '/repo', pattern: '*.ts', excludePatterns: ['node_modules'] })}
            />
        );
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent.textContent).toContain('"excludePatterns"');
        expect(inContent.textContent).toContain('node_modules');
    });

    it('renders OUT label with tool result content', () => {
        render(
            <SearchFilesRenderer
                toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })}
                toolResult={makeToolResult('/repo/src/a.ts\n/repo/src/b.ts')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/\/repo\/src\/a\.ts/)).toBeInTheDocument();
        expect(screen.getByText(/\/repo\/src\/b\.ts/)).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<SearchFilesRenderer toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not render OUT box when toolResult content is empty string', () => {
        render(
            <SearchFilesRenderer
                toolUse={makeToolUse({ path: '/repo/src', pattern: '*.ts' })}
                toolResult={makeToolResult('')}
            />
        );
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('handles missing input gracefully', () => {
        const toolUse = makeToolUse({});
        render(<SearchFilesRenderer toolUse={toolUse} />);
        expect(screen.getByText('search_files')).toBeInTheDocument();
    });
});
