import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {DebuggerEvalRenderer} from '../DebuggerEvalRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__xdebug_evaluate_expression';

describe('DebuggerEvalRenderer', () => {
    it('shows the expression in IN and the result in OUT (Bash-style)', () => {
        renderWithStatus(
            <DebuggerEvalRenderer
                toolUse={makeToolUse({expression: 'sum + i', frameIndex: 0, sessionId: 'App'}, TOOL)}
                toolResult={makeToolResult('15')}
            />
        );
        expect(screen.getByText('Debugger: evaluate expression')).toBeInTheDocument();
        expect(screen.getByText('IN')).toBeInTheDocument();
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('sum + i')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });
});
