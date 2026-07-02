import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {SearchFileRenderer} from '../SearchFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__search_file';

describe('SearchFileRenderer', () => {
    it('shows the glob, match count and clickable rows', () => {
        renderWithStatus(
            <SearchFileRenderer
                toolUse={makeToolUse({q: '**/*.py'}, TOOL)}
                toolResult={makeToolResult('{"items":[{"filePath":"src/a.py"},{"filePath":"src/b.py"}],"more":true}')}
            />
        );
        expect(screen.getByText('Search files')).toBeInTheDocument();
        expect(screen.getByText('**/*.py')).toBeInTheDocument();
        expect(screen.getByText('2+ matches')).toBeInTheDocument();
        expect(screen.getByText('src/a.py')).toBeInTheDocument();
        expect(screen.getByText('src/b.py')).toBeInTheDocument();
    });
});
