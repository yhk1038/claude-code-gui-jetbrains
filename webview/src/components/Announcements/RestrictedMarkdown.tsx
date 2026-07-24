import type { ReactNode } from 'react';
import { isSafeLinkUrl } from './urlSafety';

// Matches **bold** or [label](url) tokens; everything else is left as plain text.
// The url group tolerates one level of nested parens (e.g. `javascript:alert(1)`,
// `https://example.com/foo(bar)`) so a stray inner `)` isn't left dangling as
// literal text after the link is parsed.
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

/**
 * Renders `**bold**` and `[label](url)` inside a single line of restricted
 * markdown. Deliberately never uses `dangerouslySetInnerHTML` — every piece of
 * `text` that isn't a recognized bold/link token is pushed as a plain string,
 * which React always escapes as a text node. A literal `<script>` in the body
 * (or inside a `[label]`) can therefore never execute or inject markup.
 */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  INLINE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null = INLINE_TOKEN.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const boldText = match[1];
    if (boldText !== undefined) {
      nodes.push(<strong key={`b${key++}`}>{boldText}</strong>);
    } else {
      const label = match[2];
      const url = match[3];
      if (isSafeLinkUrl(url)) {
        nodes.push(
          <a
            key={`a${key++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            {label}
          </a>,
        );
      } else {
        // Unsafe scheme: keep the label text, drop the link entirely.
        nodes.push(label);
      }
    }
    lastIndex = INLINE_TOKEN.lastIndex;
    match = INLINE_TOKEN.exec(text);
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

type RestrictedMarkdownBlock = { type: 'list'; items: string[] } | { type: 'paragraph'; text: string };

/**
 * Groups `body` lines into paragraph/list blocks. A line starting with `- `
 * or `* ` joins the preceding list block (or starts a new one); anything else
 * becomes its own paragraph. Blank lines are separators only and never
 * rendered as empty nodes.
 */
export function parseRestrictedMarkdownBlocks(body: string): RestrictedMarkdownBlock[] {
  const blocks: RestrictedMarkdownBlock[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const listMatch = /^[-*]\s+(.*)$/.exec(line);
    if (listMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') {
        last.items.push(listMatch[1]);
      } else {
        blocks.push({ type: 'list', items: [listMatch[1]] });
      }
    } else {
      blocks.push({ type: 'paragraph', text: line });
    }
  }
  return blocks;
}

interface Props {
  body: string;
}

/**
 * Minimal, safe markdown renderer for SDUI announcement bodies — bold, links,
 * and lists only. Deliberately hand-rolled instead of reusing the chat
 * pipeline's `Streamdown` (`StreamingMessage.tsx` + `MARKDOWN_COMPONENTS`):
 * that renderer is built for assistant messages (code blocks, KaTeX, file-link
 * resolution tied to `WorkingDirContext`) — pulling all of that in for a small
 * server-driven card is both unnecessary and a larger attack surface than this
 * restricted subset needs. No raw HTML/script execution is possible here: we
 * never call `dangerouslySetInnerHTML`, so any literal markup in `body` always
 * renders as escaped text.
 */
export function RestrictedMarkdown(props: Props) {
  const { body } = props;
  const blocks = parseRestrictedMarkdownBlocks(body);
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="ml-4 list-disc space-y-0.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className={index > 0 ? 'mt-1' : undefined}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </>
  );
}
