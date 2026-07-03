import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {ProjectListRenderer} from '../ProjectListRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

describe('ProjectListRenderer', () => {
    it('lists project modules with a type badge', () => {
        renderWithStatus(
            <ProjectListRenderer
                toolUse={makeToolUse({}, 'mcp__idea__get_project_modules')}
                toolResult={makeToolResult('{"modules":[{"name":"ccg-mcp-test","type":"JAVA_MODULE"}]}')}
            />
        );
        expect(screen.getByText('Get project modules')).toBeInTheDocument();
        expect(screen.getByText('ccg-mcp-test')).toBeInTheDocument();
        expect(screen.getByText('JAVA_MODULE')).toBeInTheDocument();
    });

    it('shows "None" for empty dependencies', () => {
        renderWithStatus(
            <ProjectListRenderer
                toolUse={makeToolUse({}, 'mcp__idea__get_project_dependencies')}
                toolResult={makeToolResult('{"dependencies":[]}')}
            />
        );
        expect(screen.getByText('Get project dependencies')).toBeInTheDocument();
        expect(screen.getByText('None')).toBeInTheDocument();
    });
});
