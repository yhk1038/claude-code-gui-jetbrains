import { LINE_ANCHOR, resolveFilePath } from './tokenizeMessagePaths';

/**
 * A local file reference parsed out of an assistant markdown link href.
 * `path` has its `#L` anchor removed and is percent-decoded; `line` is the
 * 1-based line the caret should move to (undefined → open at the file top).
 */
export interface MarkdownFileLink {
  path: string;
  line?: number;
}

/** True for a Windows drive-rooted path (`C:/…` or `C:\…`), matching `joinProjectPath`. */
function isWindowsAbsolute(href: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(href);
}

/**
 * Parse a markdown link href into a local {@link MarkdownFileLink}, or `null`
 * for external hrefs (which keep normal link behavior).
 *
 * Local = POSIX-rooted (`/…`), Windows drive-rooted (`C:/…`, `C:\…`), or relative
 * (`./…`, `../…`). Protocol (`https:`, `mailto:`) and protocol-relative (`//host`)
 * URLs are external. The `#L` anchor and a leading `./` are stripped and the path
 * is percent-decoded to match the on-disk name.
 */
export function parseMarkdownFileLink(href: string): MarkdownFileLink | null {
  if (typeof href !== 'string' || href.length === 0) return null;

  const isPosixAbsolute = href.startsWith('/') && !href.startsWith('//'); // exclude protocol-relative //host
  const isRelative = href.startsWith('./') || href.startsWith('../');
  if (!isPosixAbsolute && !isWindowsAbsolute(href) && !isRelative) return null;

  const match = LINE_ANCHOR.exec(href);
  const line = match ? Number(match[1]) : undefined;

  let path = href.replace(LINE_ANCHOR, '').replace(/^\.\//, '');
  // A Windows drive path travels as `/C:/…` (leading slash so rehype-sanitize
  // doesn't parse `C:` as a URL scheme and strip the link); restore `C:/…`.
  if (/^\/[A-Za-z]:[\\/]/.test(path)) path = path.slice(1);
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed percent-escape — keep the raw path rather than throw.
  }

  return { path, line };
}

/**
 * Render a resolved local path as a link href that survives rehype-sanitize.
 * Forward-slashes it (via {@link normalizeDotSegments}) and prefixes a Windows
 * drive path with `/` so `C:` is not parsed as a URL scheme (`C:/proj` →
 * `/C:/proj`); {@link parseMarkdownFileLink} strips that leading `/` back off.
 */
export function toLocalFileHref(path: string): string {
  const normalized = normalizeDotSegments(path);
  return /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized;
}

/**
 * Collapse `.`/`..` segments in an already-resolved path (POSIX- or
 * Windows-drive-rooted, or relative) so the IDE file lookup gets a clean path,
 * e.g. `/wd/../foo.ts` → `/foo.ts`, `C:/wd/../foo.ts` → `C:/foo.ts`. Backslashes
 * are treated as separators; the result uses forward slashes. A leading `..` is
 * preserved only for relative paths (there is nothing above the root to pop).
 */
export function normalizeDotSegments(p: string): string {
  if (typeof p !== 'string' || p.length === 0) return p;

  const drive = /^([A-Za-z]:)[\\/]/.exec(p);
  let prefix = '';
  let rest = p;
  if (drive) {
    prefix = `${drive[1]}/`;
    rest = p.slice(drive[0].length);
  } else if (p.startsWith('/')) {
    prefix = '/';
    rest = p.slice(1);
  }

  const out: string[] = [];
  for (const segment of rest.split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (prefix === '') out.push('..'); // keep leading `..` only for relative paths
    } else {
      out.push(segment);
    }
  }

  return prefix + out.join('/');
}

/**
 * Parse and fully resolve a markdown link href into a local file reference
 * ready for `openFile`, or `null` for external links. Relative paths are joined
 * against `workingDir` (absolute paths pass through) and `.`/`..` segments are
 * collapsed.
 */
export function resolveMarkdownFileLink(
  href: string,
  workingDir: string | null | undefined,
): MarkdownFileLink | null {
  const parsed = parseMarkdownFileLink(href);
  if (!parsed) return null;
  return {
    path: normalizeDotSegments(resolveFilePath(parsed.path, workingDir)),
    line: parsed.line,
  };
}

/**
 * Rewrite local-file link URLs in markdown to sanitize-safe absolute paths.
 *
 * rehype-harden resolves `./` relatives against the origin (losing the project
 * path) and rehype-sanitize drops a bare `C:` as a URL scheme — so resolve local
 * links to absolute here (relatives joined to `workingDir`) via {@link toLocalFileHref}
 * (Windows drive carried as `/C:/…`). External / `#` / code-span URLs are left
 * as-is; with no working dir, relatives fall back to the `./` form.
 */
export function normalizeMarkdownLinkUrls(markdown: string, workingDir: string | null | undefined): string {
  // Mask fenced blocks and inline code so link URLs inside code are never
  // rewritten (that would corrupt shown code and leak the working directory).
  const codeSpans: string[] = [];
  const masked = markdown.replace(
    /```[\s\S]*?```|~~~[\s\S]*?~~~|`+[^`\n]*?`+/g,
    (span) => `\u0000${codeSpans.push(span) - 1}\u0000`,
  );

  // Match markdown links [text](url) but NOT image links ![text](url).
  const rewritten = masked.replace(
    /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g,
    (match, text: string, url: string) => {
      const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(url);
      // A single-letter "scheme" followed by / or \ is a Windows drive, not a URL scheme.
      const isExternal = !isWindowsAbsolute
        && (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('//') || url.startsWith('#'));
      if (isExternal) return match;
      if (url.startsWith('/') || isWindowsAbsolute) return `[${text}](${toLocalFileHref(url)})`;
      if (workingDir) return `[${text}](${toLocalFileHref(resolveFilePath(url, workingDir))})`;
      return url.startsWith('./') || url.startsWith('../') ? match : `[${text}](./${url})`;
    },
  );

  return rewritten.replace(/\u0000(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
}
