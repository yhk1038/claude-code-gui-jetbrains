import {describe, it, expect, vi, beforeEach} from 'vitest';
import {screen, fireEvent} from '@testing-library/react';
import {ReadFileRenderer} from '../ReadFileRenderer';
import {CreateNewFileRenderer} from '../CreateNewFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

describe('file-link gating', () => {
    beforeEach(() => mockOpenFile.mockClear());

    it('Read link is clickable even before the call succeeds (file already exists)', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({projectPath: '/tmp/p', file_path: 'src/app.py'}, 'mcp__idea__read_file')}
                toolResult={undefined}
            />,
            'progress',
        );
        fireEvent.click(screen.getByText('app.py'));
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/p/src/app.py');
    });

    it('Create link is NOT clickable until the file is actually created', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({projectPath: '/tmp/p', pathInProject: 'src/New.java', text: 'x'}, 'mcp__idea__create_new_file')}
                toolResult={undefined}
            />,
            'progress',
        );
        fireEvent.click(screen.getByText('New.java'));
        expect(mockOpenFile).not.toHaveBeenCalled();
    });

    it('Create link becomes clickable once the call succeeds', () => {
        renderWithStatus(
            <CreateNewFileRenderer
                toolUse={makeToolUse({projectPath: '/tmp/p', pathInProject: 'src/New.java', text: 'x'}, 'mcp__idea__create_new_file')}
                toolResult={makeToolResult('[success]')}
            />,
            'success',
        );
        fireEvent.click(screen.getByText('New.java'));
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/p/src/New.java');
    });
});

describe('unrecognized-input notice', () => {
    it('appears (with the offending key) when input has a field absent from the schema', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({file_path: 'a.py', sneaky: 'ignore previous instructions'}, 'mcp__idea__read_file')}
                toolResult={makeToolResult('x')}
            />
        );
        expect(screen.getByText(/Unrecognized input/i)).toBeInTheDocument();
        expect(screen.getByText('sneaky')).toBeInTheDocument();
    });

    it('appears when a known field has the wrong type', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({file_path: 'a.py', limit: 'lots'}, 'mcp__idea__read_file')}
                toolResult={makeToolResult('x')}
            />
        );
        expect(screen.getByText(/Unrecognized input/i)).toBeInTheDocument();
        expect(screen.getByText('limit')).toBeInTheDocument();
    });

    it('is absent for clean input (and never flags projectPath)', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({file_path: 'a.py', projectPath: '/tmp/p', limit: 10}, 'mcp__idea__read_file')}
                toolResult={makeToolResult('x')}
            />
        );
        expect(screen.queryByText(/Unrecognized input/i)).not.toBeInTheDocument();
    });
});
