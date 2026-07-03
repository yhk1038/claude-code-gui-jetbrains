import {describe, it, expect, vi, beforeEach} from 'vitest';
import {screen, fireEvent} from '@testing-library/react';
import {JetBrainsActionRenderer} from '../JetBrainsActionRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

describe('JetBrainsActionRenderer', () => {
    beforeEach(() => mockOpenFile.mockClear());

    it('renders a file action with a clickable link that opens in the correct project', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({projectPath: '/tmp/ccg-mcp-test', filePath: 'src/App.kt'}, 'mcp__idea__open_file_in_editor')}
                toolResult={makeToolResult('[success]')}
            />
        );
        expect(screen.getByText('Open file')).toBeInTheDocument();
        fireEvent.click(screen.getByText('App.kt'));
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/ccg-mcp-test/src/App.kt');
    });

    it('renders a rename as "old → new"', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({pathInProject: 'a.py', symbolName: 'greet', newName: 'hello'}, 'mcp__idea__rename_refactoring')}
                toolResult={makeToolResult('[success]')}
            />
        );
        expect(screen.getByText('Rename symbol')).toBeInTheDocument();
        expect(screen.getByText('greet → hello')).toBeInTheDocument();
    });

    it('renders an apply_patch diff with the target file and context lines', () => {
        const patch = '*** Begin Patch\n*** Update File: README.md\n@@\n # MCP Render Test\n+added line\n*** End Patch\n';
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({projectPath: '/tmp/ccg-mcp-test', input: patch}, 'mcp__idea__apply_patch')}
                toolResult={makeToolResult('1 out of 1 operations applied.')}
            />
        );
        expect(screen.getByText('Apply patch')).toBeInTheDocument();
        // target file is shown (and links into the project)
        expect(screen.getByText('README.md')).toBeInTheDocument();
        expect(screen.getByText('update')).toBeInTheDocument();
        // both the context line and the added line are visible (reviewable before approval)
        expect(screen.getByText(/# MCP Render Test/)).toBeInTheDocument();
        expect(screen.getByText(/added line/)).toBeInTheDocument();
    });

    it('reformat_file: shows the actual files[] targets (real schema field, not a count)', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({projectPath: '/tmp/p', files: ['src/App.java', 'src/B.java']}, 'mcp__idea__reformat_file')}
                toolResult={makeToolResult('[success]')}
            />
        );
        expect(screen.getByText('Reformat')).toBeInTheDocument();
        expect(screen.getByText('src/App.java')).toBeInTheDocument();
        expect(screen.getByText('src/B.java')).toBeInTheDocument();
    });

    it('xdebug_get_value_by_path: renders the array path as "a › b" (was lost when read as a string)', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({projectPath: '/tmp/p', path: ['greeter', 'name'], frameIndex: 0}, 'mcp__idea__xdebug_get_value_by_path')}
                toolResult={makeToolResult('"World"')}
            />
        );
        expect(screen.getByText('Debugger: inspect value')).toBeInTheDocument();
        expect(screen.getByText('greeter › name')).toBeInTheDocument();
    });

    it('xdebug_control_session: puts the action into the title', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({action: 'RESUME', sessionId: 'App'}, 'mcp__idea__xdebug_control_session')}
                toolResult={makeToolResult('{"status":"running"}')}
            />
        );
        expect(screen.getByText('Debugger: RESUME')).toBeInTheDocument();
    });

    it('a paused status after RESUME is neutral (not a warning) and marked OUT', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({action: 'RESUME', sessionId: 'App'}, 'mcp__idea__xdebug_control_session')}
                toolResult={makeToolResult('{"status":"paused"}')}
            />
        );
        // paused is normal (e.g. hit the next breakpoint) → neutral, not warning
        const badge = screen.getByText('paused');
        expect(badge.className).not.toContain('text-state-warning-fg');
        // the result is delineated as output for a card without an IN/OUT block
        expect(screen.getByText('OUT')).toBeInTheDocument();
    });

    it('DRAIN_EVENTS: extra result payload (drained events) is shown, not hidden behind the status', () => {
        // The compact outcome only summarizes status/old→new/applied; a result
        // with extra content (the buffered events DRAIN_EVENTS returns) must not
        // collapse to just the status badge. Field name here is illustrative —
        // the renderer surfaces ANY unrecognized payload key.
        const {container} = renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({action: 'DRAIN_EVENTS', sessionId: 'App'}, 'mcp__idea__xdebug_control_session')}
                toolResult={makeToolResult('{"status":"paused","tracepointOutputsTail":["Hello 1","Hello 2"]}')}
            />
        );
        expect(container.textContent).toContain('tracepointOutputsTail');
        expect(container.textContent).toContain('Hello 1');
    });

    it('shows the error message on failure', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({pathInProject: 'a.py', symbolName: 'greet', newName: 'hello'}, 'mcp__idea__rename_refactoring')}
                toolResult={makeToolResult("Couldn't find symbol 'greet'", true)}
            />,
            'error'
        );
        expect(screen.getByText("Couldn't find symbol 'greet'")).toBeInTheDocument();
    });
});
