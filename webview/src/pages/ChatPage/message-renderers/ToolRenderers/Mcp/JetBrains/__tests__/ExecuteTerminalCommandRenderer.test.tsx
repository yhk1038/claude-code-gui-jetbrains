import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {ExecuteTerminalCommandRenderer} from '../ExecuteTerminalCommandRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__execute_terminal_command';

describe('ExecuteTerminalCommandRenderer', () => {
    it('shows the command, exit-code badge and output', () => {
        renderWithStatus(
            <ExecuteTerminalCommandRenderer
                toolUse={makeToolUse({command: 'git init'}, TOOL)}
                toolResult={makeToolResult('{"command_exit_code":0,"command_output":"Initialized repo"}')}
            />
        );
        expect(screen.getByText('Run command')).toBeInTheDocument();
        expect(screen.getByText('git init')).toBeInTheDocument();
        expect(screen.getByText('exit 0')).toBeInTheDocument();
        expect(screen.getByText(/Initialized repo/)).toBeInTheDocument();
    });

    it('marks a non-zero exit code', () => {
        renderWithStatus(
            <ExecuteTerminalCommandRenderer
                toolUse={makeToolUse({command: 'false'}, TOOL)}
                toolResult={makeToolResult('{"command_exit_code":1,"command_output":""}')}
            />
        );
        expect(screen.getByText('exit 1')).toBeInTheDocument();
    });
});
