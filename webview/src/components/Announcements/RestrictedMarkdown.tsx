import type { ReactNode } from 'react';
import { parseRestrictedMarkdown, type InlineToken } from '@/vendor/announcement-core/markdown';

/**
 * Renders a vendored `InlineToken[]` (from `parseRestrictedMarkdown`) into React
 * nodes. Parsing — including dropping unsafe-scheme links down to plain text —
 * happens in the shared `@ccg/announcement-core` package, so this renderer only
 * turns already-classified tokens into JSX. `text` tokens are pushed as plain
 * strings, which React always escapes as text nodes: a literal `<script>` in the
 * body can never execute or inject markup (no `dangerouslySetInnerHTML`).
 */
function renderTokens(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((token, index) => {
    switch (token.type) {
      case 'bold':
        return <strong key={index}>{token.text}</strong>;
      case 'link':
        return (
          <a
            key={index}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            {token.label}
          </a>
        );
      case 'text':
        return token.text;
    }
  });
}

interface Props {
  body: string;
}

/**
 * Minimal, safe markdown renderer for SDUI announcement bodies — bold, links,
 * and lists only. Parsing is delegated to the shared `@ccg/announcement-core`
 * `parseRestrictedMarkdown` (vendored) so the plugin and the www admin agree
 * exactly on what counts as bold, a link, or a list item; this component only
 * maps the resulting `RestrictedMarkdownBlock[]` to Tailwind-styled JSX.
 *
 * Deliberately hand-rolled instead of reusing the chat pipeline's `Streamdown`
 * (`StreamingMessage.tsx` + `MARKDOWN_COMPONENTS`): that renderer is built for
 * assistant messages (code blocks, KaTeX, file-link resolution tied to
 * `WorkingDirContext`) — pulling all of that in for a small server-driven card
 * is both unnecessary and a larger attack surface than this restricted subset
 * needs. No raw HTML/script execution is possible here (see `renderTokens`).
 */
export function RestrictedMarkdown(props: Props) {
  const { body } = props;
  const blocks = parseRestrictedMarkdown(body);
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="ms-4 list-disc space-y-0.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderTokens(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className={index > 0 ? 'mt-1' : undefined}>
            {renderTokens(block.tokens)}
          </p>
        );
      })}
    </>
  );
}
