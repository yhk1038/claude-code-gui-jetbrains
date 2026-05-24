import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadMediaFileRenderer } from '../ReadMediaFileRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import type { LoadedMessageDto } from '@/types';

const mockOpenFile = vi.fn();

vi.mock('@/adapters', () => ({
    getAdapter: () => ({
        openFile: mockOpenFile,
    }),
}));

function makeToolUse(path = '/a/b/photo.png'): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name: 'read_media_file',
        input: { path },
    });
}

function makeImageResult(mediaType: string, data: string): LoadedMessageDto {
    return {
        message: {
            content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            ],
        },
    } as unknown as LoadedMessageDto;
}

function makeTextResult(text: string): LoadedMessageDto {
    return {
        message: {
            content: [{ type: ContentBlockType.ToolResult, content: text }],
        },
    } as unknown as LoadedMessageDto;
}

describe('ReadMediaFileRenderer', () => {
    beforeEach(() => {
        mockOpenFile.mockClear();
    });

    it('renders tool name and basename of file path', () => {
        render(<ReadMediaFileRenderer toolUse={makeToolUse()} />);
        expect(screen.getByText('read_media_file')).toBeInTheDocument();
        expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    it('opens file when basename is clicked', () => {
        render(<ReadMediaFileRenderer toolUse={makeToolUse()} />);
        fireEvent.click(screen.getByText('photo.png'));
        expect(mockOpenFile).toHaveBeenCalledWith('/a/b/photo.png');
    });

    it('renders IN box with JSON-stringified input', () => {
        render(<ReadMediaFileRenderer toolUse={makeToolUse()} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        const inContent = screen.getByText(/\"path\"/);
        expect(inContent).toBeInTheDocument();
        expect(inContent.textContent).toContain('"path"');
    });

    it('renders image when content has image block with base64 source', () => {
        const { container } = render(
            <ReadMediaFileRenderer
                toolUse={makeToolUse()}
                toolResult={makeImageResult('image/png', 'AAA')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        const img = container.querySelector('img') as HTMLImageElement;
        expect(img).toBeInTheDocument();
        expect(img.src).toContain('data:image/png;base64,AAA');
        expect(screen.getByText('image/png')).toBeInTheDocument();
    });

    it('renders text fallback when content is text', () => {
        render(
            <ReadMediaFileRenderer
                toolUse={makeToolUse()}
                toolResult={makeTextResult('plain text content')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('plain text content')).toBeInTheDocument();
    });

    it('does not render OUT box when toolResult is absent', () => {
        render(<ReadMediaFileRenderer toolUse={makeToolUse()} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('basename click handler not attached when path is empty', () => {
        render(<ReadMediaFileRenderer toolUse={makeToolUse('')} />);
        expect(mockOpenFile).not.toHaveBeenCalled();
    });
});
