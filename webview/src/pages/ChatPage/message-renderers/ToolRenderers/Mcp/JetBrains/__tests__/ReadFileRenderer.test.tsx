import {describe, it, expect, vi, beforeEach} from 'vitest';
import {screen, fireEvent} from '@testing-library/react';
import {ReadFileRenderer} from '../ReadFileRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const mockOpenFile = vi.fn();
vi.mock('@/adapters', () => ({getAdapter: () => ({openFile: mockOpenFile})}));

const TOOL = 'mcp__pycharm__read_file';

describe('ReadFileRenderer', () => {
    beforeEach(() => mockOpenFile.mockClear());

    it('shows the product (PyCharm), action and content', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({file_path: 'src/app.py'}, TOOL)}
                toolResult={makeToolResult('L1: print(1)')}
            />
        );
        expect(screen.getByText('PyCharm')).toBeInTheDocument();
        expect(screen.getByText('Read file')).toBeInTheDocument();
        expect(screen.getByText('app.py')).toBeInTheDocument();
        expect(screen.getByText('L1: print(1)')).toBeInTheDocument();
    });

    it('opens the file in the correct project (absolute path) on click', () => {
        renderWithStatus(
            <ReadFileRenderer
                toolUse={makeToolUse({projectPath: '/tmp/ccg-mcp-test', file_path: 'src/app.py'}, TOOL)}
                toolResult={makeToolResult('L1: x')}
            />
        );
        fireEvent.click(screen.getByText('app.py'));
        expect(mockOpenFile).toHaveBeenCalledWith('/tmp/ccg-mcp-test/src/app.py');
    });
});
