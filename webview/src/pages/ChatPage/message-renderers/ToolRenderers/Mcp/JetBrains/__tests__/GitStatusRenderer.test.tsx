import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {GitStatusRenderer} from '../GitStatusRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__git_status';

describe('GitStatusRenderer', () => {
    it('lists changed files with a status badge', () => {
        renderWithStatus(
            <GitStatusRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"repositories":[{"totalEntries":1,"entries":[{"pathRelativeToRepository":"README.md","indexStatus":"?","workTreeStatus":"?"}]}]}')}
            />
        );
        expect(screen.getByText('Git status')).toBeInTheDocument();
        expect(screen.getByText('1 change')).toBeInTheDocument();
        expect(screen.getByText('untracked')).toBeInTheDocument();
        expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    it('shows a clean working tree', () => {
        renderWithStatus(
            <GitStatusRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"repositories":[{"totalEntries":0,"entries":[]}]}')}
            />
        );
        expect(screen.getByText('Working tree clean')).toBeInTheDocument();
    });
});
