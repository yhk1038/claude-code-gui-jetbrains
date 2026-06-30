import {describe, it, expect, vi} from 'vitest';
import {screen} from '@testing-library/react';
import {ExecuteTerminalCommandRenderer} from '../ExecuteTerminalCommandRenderer';
import {ProblemsRenderer} from '../ProblemsRenderer';
import {JetBrainsActionRenderer} from '../JetBrainsActionRenderer';
import {BreakpointRenderer} from '../BreakpointRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: vi.fn()})}));

/** The leading status bullet rendered by ToolWrapper. */
const bulletClass = () => screen.getByText('●').className;

describe('status dot reflects payload-level failure', () => {
    it('terminal: non-zero exit code → red dot', () => {
        renderWithStatus(
            <ExecuteTerminalCommandRenderer
                toolUse={makeToolUse({command: 'git bogus'}, 'mcp__idea__execute_terminal_command')}
                toolResult={makeToolResult('{"command_exit_code":1,"command_output":"not a git command"}')}
            />,
        );
        expect(bulletClass()).toContain('text-state-error-fg');
    });

    it('terminal: exit 0 → green dot', () => {
        renderWithStatus(
            <ExecuteTerminalCommandRenderer
                toolUse={makeToolUse({command: 'git init'}, 'mcp__idea__execute_terminal_command')}
                toolResult={makeToolResult('{"command_exit_code":0,"command_output":"ok"}')}
            />,
        );
        expect(bulletClass()).toContain('text-state-success-fg');
    });

    it('build_project: isSuccess:false → red dot + problem row', () => {
        renderWithStatus(
            <ProblemsRenderer
                toolUse={makeToolUse({}, 'mcp__idea__build_project')}
                toolResult={makeToolResult('{"isSuccess":false,"problems":[{"file":"src/Broken.java","line":4,"kind":"ERROR","description":"missing return value"}]}')}
            />,
        );
        expect(screen.getByText('Build project')).toBeInTheDocument();
        expect(bulletClass()).toContain('text-state-error-fg');
        expect(screen.getByText(/missing return value/)).toBeInTheDocument();
    });

    it('build_project: isSuccess:true → green dot + "Build succeeded"', () => {
        renderWithStatus(
            <ProblemsRenderer
                toolUse={makeToolUse({}, 'mcp__idea__build_project')}
                toolResult={makeToolResult('{"isSuccess":true,"problems":[]}')}
            />,
        );
        expect(screen.getByText('Build succeeded')).toBeInTheDocument();
        expect(bulletClass()).toContain('text-state-success-fg');
    });

    it('set_variable: applied:false → red dot + "not applied"', () => {
        renderWithStatus(
            <JetBrainsActionRenderer
                toolUse={makeToolUse({path: ['sum'], newValue: '100'}, 'mcp__idea__xdebug_set_variable')}
                toolResult={makeToolResult('{"path":["sum"],"oldValue":"0","newValue":"100","applied":false}')}
            />,
        );
        expect(bulletClass()).toContain('text-state-error-fg');
        expect(screen.getByText('not applied')).toBeInTheDocument();
        expect(screen.getByText('0 → 100')).toBeInTheDocument();
    });

    it('remove_breakpoint: removed:false → red dot', () => {
        renderWithStatus(
            <BreakpointRenderer
                toolUse={makeToolUse({filePath: 'src/A.java', line: 7}, 'mcp__idea__xdebug_remove_breakpoint')}
                toolResult={makeToolResult('{"removed":false,"message":"No breakpoint at that line"}')}
            />,
        );
        expect(bulletClass()).toContain('text-state-error-fg');
        expect(screen.getByText(/No breakpoint at that line/)).toBeInTheDocument();
    });
});
