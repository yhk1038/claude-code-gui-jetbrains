import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {McpToolBody} from '../_common';

// McpToolBody wraps the raw JSON IN/OUT rows shared by every MCP renderer
// (Filesystem, JetBrains, Gmail, Generic). It must always render dir="ltr" so
// JSON punctuation/indentation doesn't flip under <html dir="rtl">.
describe('McpToolBody — RTL exception (JSON in/out content stays LTR)', () => {
    it('renders with dir="ltr"', () => {
        render(<McpToolBody>{'{"path":"/a/b"}'}</McpToolBody>);
        const el = screen.getByText('{"path":"/a/b"}');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});
