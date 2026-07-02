import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {OpenFilesRenderer} from '../OpenFilesRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__get_all_open_file_paths';

describe('OpenFilesRenderer', () => {
    it('lists open files and badges the active one', () => {
        renderWithStatus(
            <OpenFilesRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"activeFilePath":"src/app.py","openFiles":["src/app.py","src/b.py"]}')}
            />
        );
        expect(screen.getByText('Get all open file paths')).toBeInTheDocument();
        expect(screen.getByText('src/app.py')).toBeInTheDocument();
        expect(screen.getByText('src/b.py')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();
    });
});
