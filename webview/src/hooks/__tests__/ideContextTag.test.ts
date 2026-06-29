import { describe, it, expect } from 'vitest';
import {
  buildIdeContextTag,
  injectIdeContext,
  isSameSelection,
  selectionKey,
} from '../ideContextTag';
import type { IdeSelectionPayload } from '../useIdeSelection';
import { parseUserContent } from '@/pages/ChatPage/message-renderers/utils/parseUserContent';
import { ContextType } from '@/types';

const fileOnly: IdeSelectionPayload = {
  absolutePath: '/work/src/file.ts',
  relativePath: 'src/file.ts',
  startLine: null,
  endLine: null,
  selectedText: null,
  workingDir: '/work',
};

const withSelection: IdeSelectionPayload = {
  absolutePath: '/work/src/file.ts',
  relativePath: 'src/file.ts',
  startLine: 42,
  endLine: 51,
  selectedText: 'const x = 1;\nconst y = 2;',
  workingDir: '/work',
};

// ---------------------------------------------------------------------------
// buildIdeContextTag
// ---------------------------------------------------------------------------

describe('buildIdeContextTag', () => {
  it('builds an <ide_selection> tag when text is selected', () => {
    const tag = buildIdeContextTag(withSelection);
    expect(tag).toBe(
      '<ide_selection>The user selected the lines 42 to 51 from src/file.ts:\n' +
        'const x = 1;\nconst y = 2;\n\n' +
        'This may or may not be related to the current task.</ide_selection>',
    );
  });

  it('builds an <ide_opened_file> tag when only a file is open', () => {
    const tag = buildIdeContextTag(fileOnly);
    expect(tag).toBe(
      '<ide_opened_file>The user opened the file src/file.ts in the IDE. ' +
        'This may or may not be related to the current task.</ide_opened_file>',
    );
  });

  it('falls back to <ide_opened_file> when lines exist but selectedText is empty', () => {
    const tag = buildIdeContextTag({ ...withSelection, selectedText: '' });
    expect(tag?.startsWith('<ide_opened_file>')).toBe(true);
  });

  it('returns null when relativePath is empty', () => {
    expect(buildIdeContextTag({ ...fileOnly, relativePath: '' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Round-trip: built tag parses back to the original Context
// ---------------------------------------------------------------------------

describe('buildIdeContextTag round-trips through parseUserContent', () => {
  it('selection tag → Context { type: selection, path, startLine, endLine }', () => {
    const tag = buildIdeContextTag(withSelection)!;
    const { contexts, text } = parseUserContent(`${tag}\nhello`);
    expect(text).toBe('hello');
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe(ContextType.Selection);
    expect(contexts[0].path).toBe('src/file.ts');
    expect(contexts[0].startLine).toBe(42);
    expect(contexts[0].endLine).toBe(51);
    expect(contexts[0].content).toBe('const x = 1;\nconst y = 2;');
  });

  it('opened-file tag → Context { type: file, path }', () => {
    const tag = buildIdeContextTag(fileOnly)!;
    const { contexts, text } = parseUserContent(`${tag}\nhello`);
    expect(text).toBe('hello');
    expect(contexts).toHaveLength(1);
    expect(contexts[0].type).toBe(ContextType.File);
    expect(contexts[0].path).toBe('src/file.ts');
  });
});

// ---------------------------------------------------------------------------
// selectionKey / isSameSelection
// ---------------------------------------------------------------------------

describe('isSameSelection', () => {
  it('returns false against a null previous key', () => {
    expect(isSameSelection(null, selectionKey(withSelection))).toBe(false);
  });

  it('returns true for identical selections', () => {
    expect(isSameSelection(selectionKey(withSelection), selectionKey(withSelection))).toBe(true);
  });

  it('returns false when the line range differs', () => {
    const other = selectionKey({ ...withSelection, endLine: 99 });
    expect(isSameSelection(selectionKey(withSelection), other)).toBe(false);
  });

  it('returns false when the selected text differs', () => {
    const other = selectionKey({ ...withSelection, selectedText: 'different' });
    expect(isSameSelection(selectionKey(withSelection), other)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// injectIdeContext
// ---------------------------------------------------------------------------

describe('injectIdeContext', () => {
  it('prepends an <ide_selection> tag for a fresh selection', () => {
    const result = injectIdeContext({
      content: 'fix this',
      selection: withSelection,
      includeSelection: true,
      lastInjected: null,
    });
    expect(result.content.startsWith('<ide_selection>')).toBe(true);
    expect(result.content.endsWith('\nfix this')).toBe(true);
    expect(result.injected).toEqual(selectionKey(withSelection));
  });

  it('prepends an <ide_opened_file> tag when there is no selection', () => {
    const result = injectIdeContext({
      content: 'fix this',
      selection: fileOnly,
      includeSelection: true,
      lastInjected: null,
    });
    expect(result.content.startsWith('<ide_opened_file>')).toBe(true);
    expect(result.injected).toEqual(selectionKey(fileOnly));
  });

  it('does not inject when the toggle is off', () => {
    const result = injectIdeContext({
      content: 'fix this',
      selection: withSelection,
      includeSelection: false,
      lastInjected: null,
    });
    expect(result.content).toBe('fix this');
    expect(result.injected).toBeNull();
  });

  it('does not inject when there is no selection at all', () => {
    const result = injectIdeContext({
      content: 'fix this',
      selection: null,
      includeSelection: true,
      lastInjected: null,
    });
    expect(result.content).toBe('fix this');
    expect(result.injected).toBeNull();
  });

  it('does not inject ahead of a slash command', () => {
    const result = injectIdeContext({
      content: '/compact',
      selection: withSelection,
      includeSelection: true,
      lastInjected: null,
    });
    expect(result.content).toBe('/compact');
    expect(result.injected).toBeNull();
  });

  it('skips re-injecting an unchanged selection', () => {
    const result = injectIdeContext({
      content: 'again',
      selection: withSelection,
      includeSelection: true,
      lastInjected: selectionKey(withSelection),
    });
    expect(result.content).toBe('again');
    expect(result.injected).toBeNull();
  });

  it('re-injects when the selection changed since the last send', () => {
    const moved = { ...withSelection, startLine: 100, endLine: 110 };
    const result = injectIdeContext({
      content: 'again',
      selection: moved,
      includeSelection: true,
      lastInjected: selectionKey(withSelection),
    });
    expect(result.content.startsWith('<ide_selection>')).toBe(true);
    expect(result.injected).toEqual(selectionKey(moved));
  });
});
