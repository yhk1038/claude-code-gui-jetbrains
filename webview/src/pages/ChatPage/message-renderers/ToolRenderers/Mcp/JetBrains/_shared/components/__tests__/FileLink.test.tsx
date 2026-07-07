import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {JetBrainsFileLink, PathRow} from '../FileLink';

vi.mock('@/adapters', () => ({
    getAdapter: () => ({openFile: vi.fn()}),
}));

// JetBrainsFileLink and PathRow render file paths shared across the JetBrains
// MCP tool family. They must always render dir="ltr" so a path's `/` segments
// don't reorder under <html dir="rtl">.
describe('JetBrainsFileLink — RTL exception (path content stays LTR)', () => {
    it('renders with dir="ltr"', () => {
        render(<JetBrainsFileLink path="src/foo/bar.ts" />);
        const el = screen.getByText('bar.ts').closest('span[dir]');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});

describe('PathRow — RTL exception (path content stays LTR)', () => {
    it('renders with dir="ltr"', () => {
        render(<PathRow path="src/foo/bar.ts" />);
        const el = screen.getByText('src/foo/bar.ts');
        expect(el).toHaveAttribute('dir', 'ltr');
    });
});
