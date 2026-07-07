import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {Container, Value, LabelValue} from '../index';

// Container/Value wrap raw code, command, and JSON output (Bash IN/OUT,
// NotebookEdit source, TaskOutput result, ...). They must always render
// dir="ltr" regardless of the surrounding <html dir="rtl"> UI mirroring, or
// diff/code punctuation and indentation would flip (see streaming.css's
// "RTL exception" block for the streamdown equivalent of this rule).
describe('Container — RTL exception (code/output content stays LTR)', () => {
    it('renders with dir="ltr"', () => {
        render(<Container>raw code content</Container>);
        const el = screen.getByText('raw code content');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});

describe('Value — RTL exception (code/output content stays LTR)', () => {
    it('renders with dir="ltr"', () => {
        render(<Value>const x = 1;</Value>);
        const el = screen.getByText('const x = 1;');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});

describe('LabelValue — composed with Value, stays LTR', () => {
    it('renders the value content with dir="ltr"', () => {
        render(<LabelValue label="OUT">echo hello</LabelValue>);
        const el = screen.getByText('echo hello');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});
