import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {JetBrainsGenericRenderer} from '../JetBrainsGenericRenderer';
import {makeToolUse, makeToolResult, renderWithStatus} from './helpers';

const TOOL = 'mcp__idea__get_symbol_info';

describe('JetBrainsGenericRenderer', () => {
    it('renders the branded product name + human title', () => {
        renderWithStatus(<JetBrainsGenericRenderer toolUse={makeToolUse({}, TOOL)} />);
        expect(screen.getByText('IntelliJ IDEA')).toBeInTheDocument();
        expect(screen.getByText('Symbol info')).toBeInTheDocument();
    });

    it('suppresses trivial results (relies on the status dot)', () => {
        renderWithStatus(
            <JetBrainsGenericRenderer toolUse={makeToolUse({}, TOOL)} toolResult={makeToolResult('[success]')} />
        );
        expect(screen.queryByText('[success]')).not.toBeInTheDocument();
    });

    it('pretty-prints JSON output', () => {
        renderWithStatus(
            <JetBrainsGenericRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('{"documentation":"hi"}')}
            />
        );
        expect(screen.getByText(/"documentation": "hi"/)).toBeInTheDocument();
    });

    it('shows the error message on failure', () => {
        renderWithStatus(
            <JetBrainsGenericRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('boom', true)}
            />,
            'error'
        );
        expect(screen.getByText('boom')).toBeInTheDocument();
    });
});
