import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {GetRunConfigurationsRenderer} from '../GetRunConfigurationsRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__get_run_configurations';

describe('GetRunConfigurationsRenderer', () => {
    it('lists configurations with a description badge', () => {
        renderWithStatus(
            <GetRunConfigurationsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"configurations":[{"name":"build","description":"Gradle build"}]}')}
            />
        );
        expect(screen.getByText('Get run configurations')).toBeInTheDocument();
        expect(screen.getByText('build')).toBeInTheDocument();
        expect(screen.getByText('Gradle build')).toBeInTheDocument();
    });

    it('shows "No run configurations" when empty', () => {
        renderWithStatus(
            <GetRunConfigurationsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"configurations":[]}')}
            />
        );
        expect(screen.getByText('No run configurations')).toBeInTheDocument();
    });
});
