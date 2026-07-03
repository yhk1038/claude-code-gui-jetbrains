import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {SearchTextRenderer} from '../SearchTextRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__search_text';

describe('SearchTextRenderer', () => {
    it('shows the query, count and path:line rows', () => {
        renderWithStatus(
            <SearchTextRenderer
                toolUse={makeToolUse({q: 'def'}, TOOL)}
                toolResult={makeToolResult('{"items":[{"filePath":"src/app.py","startLine":4}]}')}
            />
        );
        expect(screen.getByText('Search in files')).toBeInTheDocument();
        expect(screen.getByText('def')).toBeInTheDocument();
        expect(screen.getByText('1 match')).toBeInTheDocument();
        expect(screen.getByText('src/app.py:4')).toBeInTheDocument();
    });
});
