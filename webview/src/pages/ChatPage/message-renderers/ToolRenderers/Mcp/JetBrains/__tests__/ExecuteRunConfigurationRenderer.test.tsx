import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {ExecuteRunConfigurationRenderer} from '../ExecuteRunConfigurationRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__execute_run_configuration';

describe('ExecuteRunConfigurationRenderer', () => {
    it('shows the target config, exit-code badge and output', () => {
        renderWithStatus(
            <ExecuteRunConfigurationRenderer
                toolUse={makeToolUse({configurationName: 'build'}, TOOL)}
                toolResult={makeToolResult('{"output":"BUILD OK","exitCode":0}')}
            />
        );
        expect(screen.getByText('Run')).toBeInTheDocument();
        expect(screen.getByText('build')).toBeInTheDocument();
        expect(screen.getByText('exit 0')).toBeInTheDocument();
        expect(screen.getByText('BUILD OK')).toBeInTheDocument();
    });

    it('shows the error message when no run point exists', () => {
        renderWithStatus(
            <ExecuteRunConfigurationRenderer
                toolUse={makeToolUse({filePath: 'src/app.py', line: 7}, TOOL)}
                toolResult={makeToolResult('No run configuration could be created from src/app.py:7.', true)}
            />,
            'error'
        );
        expect(screen.getByText(/No run configuration could be created/)).toBeInTheDocument();
    });
});
