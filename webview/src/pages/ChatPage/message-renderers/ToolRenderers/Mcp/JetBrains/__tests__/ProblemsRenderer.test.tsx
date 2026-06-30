import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {ProblemsRenderer} from '../ProblemsRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__get_file_problems';

describe('ProblemsRenderer', () => {
    it('lists problems with a severity badge and location', () => {
        renderWithStatus(
            <ProblemsRenderer
                toolUse={makeToolUse({filePath: 'src/broken.py'}, TOOL)}
                toolResult={makeToolResult('{"filePath":"src/broken.py","errors":[{"severity":"ERROR","description":"bad syntax","line":1}]}')}
            />
        );
        expect(screen.getByText('Inspect file')).toBeInTheDocument();
        expect(screen.getByText('1 problem')).toBeInTheDocument();
        expect(screen.getByText('ERROR')).toBeInTheDocument();
        expect(screen.getByText('bad syntax')).toBeInTheDocument();
        expect(screen.getByText('src/broken.py:1')).toBeInTheDocument();
    });

    it('shows "No problems" when there are none', () => {
        renderWithStatus(
            <ProblemsRenderer
                toolUse={makeToolUse({filePath: 'src/ok.py'}, TOOL)}
                toolResult={makeToolResult('{"filePath":"src/ok.py","errors":[]}')}
            />
        );
        expect(screen.getByText('No problems')).toBeInTheDocument();
    });
});
