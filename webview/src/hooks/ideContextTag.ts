import type { IdeSelectionPayload } from './useIdeSelection';

/**
 * A previously injected selection, tracked so an unchanged IDE context is not
 * re-injected on every consecutive send. Compared field-by-field against the
 * current payload (relativePath + line range + selected text).
 */
export interface InjectedSelectionKey {
  relativePath: string;
  startLine: number | null;
  endLine: number | null;
  selectedText: string | null;
}

/**
 * Build the IDE-context tag string that gets prepended to a user message so the
 * webview's parseUserContent() reconstructs it into a context chip and the CLI
 * receives the same hint.
 *
 * The exact wording MUST stay byte-for-byte in sync with the regexes in
 * parseUserContent.ts (parseOpenedFileTag / parseSelectionTag) — a single
 * character drift breaks round-tripping.
 *
 * - With selected text → <ide_selection> carrying the line range + code.
 * - Without selected text (file only) → <ide_opened_file>.
 *
 * Returns null when there is nothing meaningful to inject.
 */
export function buildIdeContextTag(payload: IdeSelectionPayload): string | null {
  const { relativePath, startLine, endLine, selectedText } = payload;
  if (!relativePath) return null;

  const hasSelection =
    typeof startLine === 'number' &&
    typeof endLine === 'number' &&
    selectedText !== null &&
    selectedText.length > 0;

  if (hasSelection) {
    return (
      `<ide_selection>The user selected the lines ${startLine} to ${endLine} ` +
      `from ${relativePath}:\n${selectedText}\n\n` +
      `This may or may not be related to the current task.</ide_selection>`
    );
  }

  return (
    `<ide_opened_file>The user opened the file ${relativePath} in the IDE. ` +
    `This may or may not be related to the current task.</ide_opened_file>`
  );
}

/** The selection identity used for duplicate detection. */
export function selectionKey(payload: IdeSelectionPayload): InjectedSelectionKey {
  return {
    relativePath: payload.relativePath,
    startLine: payload.startLine,
    endLine: payload.endLine,
    selectedText: payload.selectedText,
  };
}

/** Whether two selection keys refer to the exact same IDE context. */
export function isSameSelection(
  a: InjectedSelectionKey | null,
  b: InjectedSelectionKey,
): boolean {
  if (!a) return false;
  return (
    a.relativePath === b.relativePath &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine &&
    a.selectedText === b.selectedText
  );
}

export interface InjectIdeContextParams {
  /** The raw user-typed content (already trimmed by the caller is fine). */
  content: string;
  /** The latest IDE selection, or null when none is available. */
  selection: IdeSelectionPayload | null;
  /** Whether the user has the context toggle enabled. */
  includeSelection: boolean;
  /** The selection injected on the previous send, for duplicate suppression. */
  lastInjected: InjectedSelectionKey | null;
}

export interface InjectIdeContextResult {
  /** The content to send, with the tag prepended when injected. */
  content: string;
  /** The selection key that was injected this time, or null when nothing was. */
  injected: InjectedSelectionKey | null;
}

/**
 * Decide whether to prepend an IDE-context tag to a message and produce the
 * resulting content. Pure so it can be unit-tested and round-tripped through
 * parseUserContent().
 *
 * Gates (in order):
 *  1. toggle off or no selection → no injection.
 *  2. slash command (content starts with '/') → no injection.
 *  3. identical to the previously injected selection → no injection.
 */
export function injectIdeContext(params: InjectIdeContextParams): InjectIdeContextResult {
  const { content, selection, includeSelection, lastInjected } = params;

  if (!includeSelection || !selection) {
    return { content, injected: null };
  }

  // Gate 1: never inject ahead of a slash command.
  if (content.trim().startsWith('/')) {
    return { content, injected: null };
  }

  const key = selectionKey(selection);

  // Gate 2: skip when nothing changed since the last injection.
  if (isSameSelection(lastInjected, key)) {
    return { content, injected: null };
  }

  const tag = buildIdeContextTag(selection);
  if (!tag) {
    return { content, injected: null };
  }

  return { content: `${tag}\n${content}`, injected: key };
}
