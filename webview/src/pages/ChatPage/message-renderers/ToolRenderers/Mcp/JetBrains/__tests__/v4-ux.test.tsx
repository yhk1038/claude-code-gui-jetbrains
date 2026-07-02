import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {buildUserDeclinedContent} from '@/shared';
import {ToolUseContext} from '../../../common';
import {JetBrainsToolHeader, PathRow} from '../_shared';
import {JetBrainsActionRenderer} from '../JetBrainsActionRenderer';
import {ListDirectoryTreeRenderer} from '../ListDirectoryTreeRenderer';
import {SearchFileRenderer} from '../SearchFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

beforeEach(() => mockOpenFile.mockClear());

describe('denied permission renders as a user decision (#6)', () => {
    it('shows a neutral "declined" note with the instruction, not a red error', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({filePath: 'src/A.java', line: 10}, 'mcp__idea__xdebug_run_to_line')}
                toolResult={makeToolResult(buildUserDeclinedContent('run all the way to line 10'), true)}
            />,
            'declined',
        );
        expect(screen.getByText('declined')).toBeInTheDocument();
        const note = screen.getByText(/run all the way to line 10/);
        expect(note).toBeInTheDocument();
        expect(note.className).not.toContain('text-state-error-fg');
    });
});

describe('product-name tooltip shows the raw MCP tool id (#1)', () => {
    it('renders the product name with a cursor-help trigger (raw id on hover)', () => {
        // The IDE never sends display metadata (no tool_use_meta), so the hover
        // tooltip is simply the raw tool name — the exact id a CLI user sees. It
        // lives in a JS tooltip (Tippy), not a native `title=` (dead in JCEF), so
        // we assert the trigger is marked cursor-help rather than the hover text.
        render(
            <ToolUseContext.Provider value={makeToolUse({}, 'mcp__idea__build_project')}>
                <JetBrainsToolHeader name="mcp__idea__build_project" />
            </ToolUseContext.Provider>,
        );
        const name = screen.getByText('IntelliJ IDEA');
        expect(name.className).toContain('cursor-help');
    });
});

describe('project-root reference is consistent and clickable (#2)', () => {
    it('list_directory_tree of "." shows a clickable "project root"', () => {
        renderWithStatus(
            <ListDirectoryTreeRenderer
                toolUse={makeToolUse({directoryPath: '.', projectPath: '/tmp/p'}, 'mcp__idea__list_directory_tree')}
                toolResult={makeToolResult('{"tree":"."}')}
            />,
        );
        const root = screen.getByText('project root');
        fireEvent.click(root);
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/p');
    });

    it('search with no paths scope shows "project root" instead of plain text', () => {
        renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({q: '**/*.java', projectPath: '/tmp/p'}, 'mcp__idea__search_file')}
                toolResult={makeToolResult('{"items":[]}')}
            />,
        );
        expect(screen.getByText('project root')).toBeInTheDocument();
    });
});

describe('result-row link: line navigation + no list toggle (#4/#7)', () => {
    it('opens the file at the line and stops the click from bubbling', () => {
        const parentClick = vi.fn();
        render(
            <div onClick={parentClick}>
                <PathRow path="src/a.py" line={10} projectPath="/tmp/p" />
            </div>,
        );
        const row = screen.getByText('src/a.py:10');
        fireEvent.click(row);
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/p/src/a.py', 10);
        expect(parentClick).not.toHaveBeenCalled();
    });
});
