import {describe, it, expect, vi, beforeEach} from 'vitest';
import {screen, fireEvent} from '@testing-library/react';
import {CreateNewFileRenderer} from '../CreateNewFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

const TOOL = 'mcp__idea__create_new_file';

describe('CreateNewFileRenderer', () => {
    beforeEach(() => mockOpenFile.mockClear());

    it('shows the product name, human action, basename and content preview', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({pathInProject: 'src/app.py', text: 'a\nb\nc'}, TOOL)}
                toolResult={makeToolResult('[success]')}
            />
        );
        expect(screen.getByText('IntelliJ IDEA')).toBeInTheDocument();
        expect(screen.getByText('Create new file')).toBeInTheDocument();
        expect(screen.getByText('app.py')).toBeInTheDocument();
        expect(screen.getByText('3 lines')).toBeInTheDocument();
        expect(screen.getByText(/a\s*b\s*c/)).toBeInTheDocument();
    });

    it('does NOT render a raw "[success]" OUT row', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({pathInProject: 'src/app.py', text: 'x'}, TOOL)}
                toolResult={makeToolResult('[success]')}
            />
        );
        expect(screen.queryByText('[success]')).not.toBeInTheDocument();
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('opens the created file in the correct project (absolute path) on click', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({projectPath: '/tmp/ccg-mcp-test', pathInProject: 'src/app.py', text: 'x'}, TOOL)}
                toolResult={makeToolResult('[success]')}
            />,
            'success'
        );
        fireEvent.click(screen.getByText('app.py'));
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/ccg-mcp-test/src/app.py');
    });

    it('is NOT clickable while still pending (file not created yet)', () => {
        renderWithStatus(
            <CreateNewFileRenderer toolUse={makeToolUse({pathInProject: 'src/app.py', text: 'x'}, TOOL)} />,
            'pending'
        );
        fireEvent.click(screen.getByText('app.py'));
        expect(mockOpenFile).not.toHaveBeenCalled();
    });

    it('shows the error message when the result is an error', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({pathInProject: 'src/app.py', text: 'x'}, TOOL)}
                toolResult={makeToolResult('File already exists', true)}
            />,
            'error'
        );
        expect(screen.getByText('File already exists')).toBeInTheDocument();
    });
});
