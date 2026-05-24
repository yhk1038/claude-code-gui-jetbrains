import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DirectoryTreeRenderer } from '../DirectoryTreeRenderer';
import { ToolUseBlockDto, ContentBlockType } from '@/dto';
import { LoadedMessageDto, MessageDto } from '@/types';
import { MessageRole } from '@/dto/common';

vi.mock('@/adapters', () => ({ getAdapter: () => ({ openFile: vi.fn() }) }));

function makeToolUse(input: { path: string; excludePatterns?: string[] } = { path: '/a/b/c' }): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name: 'directory_tree',
        input,
    });
}

function makeResult(text: string): LoadedMessageDto {
    const msg = Object.assign(new MessageDto(), {
        role: MessageRole.User,
        content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: text }],
    });
    return Object.assign(new LoadedMessageDto(), { message: msg });
}

describe('DirectoryTreeRenderer', () => {
    it('renders tool name and path basename in header', () => {
        render(<DirectoryTreeRenderer toolUse={makeToolUse()} toolResult={makeResult('tree output')} />);
        expect(screen.getByText('directory_tree')).toBeInTheDocument();
        expect(screen.getByText('c')).toBeInTheDocument();
    });

    it('renders IN and OUT rows with content', () => {
        const output = 'some tree text\n  subdir/\n    file.ts';
        render(<DirectoryTreeRenderer toolUse={makeToolUse()} toolResult={makeResult(output)} />);
        expect(screen.getByText('IN')).toBeInTheDocument();
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText((_, el) => el?.textContent === output)).toBeInTheDocument();
    });

    it('renders excludePatterns in IN row when provided', () => {
        const toolUse = makeToolUse({ path: '/a/b', excludePatterns: ['node_modules', '.git'] });
        render(<DirectoryTreeRenderer toolUse={toolUse} toolResult={makeResult('output')} />);
        const inContent = screen.getByText(/node_modules/);
        expect(inContent).toBeInTheDocument();
    });

    it('renders raw JSON tree text as-is in OUT row', () => {
        const tree = JSON.stringify([
            { name: 'src', type: 'directory', children: [{ name: 'index.ts', type: 'file' }] },
            { name: 'README.md', type: 'file' },
        ]);
        render(<DirectoryTreeRenderer toolUse={makeToolUse()} toolResult={makeResult(tree)} />);
        expect(screen.getByText(tree)).toBeInTheDocument();
    });

    it('does not render OUT row when output is empty', () => {
        render(<DirectoryTreeRenderer toolUse={makeToolUse()} toolResult={makeResult('')} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });
});
