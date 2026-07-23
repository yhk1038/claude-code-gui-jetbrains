import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { StreamingMessage } from '../StreamingMessage';

const mockOpenFile = vi.fn((_path: string, _line?: number) => Promise.resolve());

// Override only getAdapter().openFile; keep the rest of the module so ToolWrapper
// and other consumers still work.
vi.mock('@/adapters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/adapters')>()),
  getAdapter: () => ({ openFile: mockOpenFile }),
}));

// Provide a working directory so relative links resolve; keep the rest of the module.
vi.mock('@/contexts/WorkingDirContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/WorkingDirContext')>()),
  useWorkingDirOrNull: () => ({ workingDirectory: '/wd', setWorkingDirectory: () => {}, ideRoot: null }),
}));

describe('StreamingMessage — local file links open in the IDE', () => {
  beforeEach(() => mockOpenFile.mockClear());

  it('opens an absolute local link at its line', () => {
    render(<StreamingMessage content="See [foo.ts:12](/abs/foo.ts#L12)." isStreaming={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'foo.ts:12' }));
    expect(mockOpenFile).toHaveBeenCalledTimes(1);
    expect(mockOpenFile).toHaveBeenCalledWith('/abs/foo.ts', 12);
  });

  it('resolves a relative link against the working directory', () => {
    render(<StreamingMessage content="See [x](./src/foo.ts#L3)." isStreaming={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'x' }));
    expect(mockOpenFile).toHaveBeenCalledWith('/wd/src/foo.ts', 3);
  });

  it('opens a link with no #L at the top (no line argument)', () => {
    render(<StreamingMessage content="See [x](/abs/foo.ts)." isStreaming={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'x' }));
    expect(mockOpenFile).toHaveBeenCalledWith('/abs/foo.ts', undefined);
  });

  it('opens a Windows drive-absolute link (survives sanitize/harden)', () => {
    // The link must round-trip through rehype-sanitize (which would strip a bare
    // `C:` scheme) — the preprocessor carries it as `/C:/…`.
    const { container } = render(
      <StreamingMessage content="See [foo.ts](C:/proj/foo.ts#L7)." isStreaming={false} />,
    );
    // Not blocked (no greyed-out placeholder), and clickable.
    expect(container.textContent).not.toMatch(/\[blocked\]/i);
    fireEvent.click(screen.getByRole('button', { name: 'foo.ts' }));
    const [path, line] = mockOpenFile.mock.calls[0];
    // harden may lowercase the drive letter; the filesystem is case-insensitive.
    expect(path.toLowerCase()).toBe('c:/proj/foo.ts');
    expect(line).toBe(7);
  });

  it('does not rewrite link URLs inside inline code', () => {
    const { container } = render(
      <StreamingMessage content={'Use `[a](./foo.ts)` here.'} isStreaming={false} />,
    );
    const code = container.querySelector('[data-streamdown="inline-code"]');
    expect(code?.textContent).toBe('[a](./foo.ts)'); // verbatim, no /wd/ injected
    expect(mockOpenFile).not.toHaveBeenCalled();
  });

  it('renders an in-page # anchor as a same-tab link', () => {
    render(<StreamingMessage content="See [Sec](#section)." isStreaming={false} />);
    const anchor = screen.getByRole('link', { name: 'Sec' });
    expect(anchor.getAttribute('href')).toBe('#section');
    expect(anchor.getAttribute('target')).toBeNull();
  });

  it('renders an external link as a normal web link and never calls openFile', () => {
    render(<StreamingMessage content="See [site](https://example.com)." isStreaming={false} />);
    const anchor = screen.getByRole('link', { name: 'site' }) as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toMatch(/^https:\/\/example\.com/);
    expect(anchor.getAttribute('target')).toBe('_blank');
    fireEvent.click(anchor);
    expect(mockOpenFile).not.toHaveBeenCalled();
  });
});
