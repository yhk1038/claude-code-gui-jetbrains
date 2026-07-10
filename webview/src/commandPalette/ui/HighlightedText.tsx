import React from 'react';
import { highlightQuery } from '../highlightQuery';

interface Props {
  text: string;
  query: string;
}

/**
 * Render `text` with the case-insensitive matches of `query` bolded, so the
 * palette highlights why an item matched (issue #167). With an empty/unmatched
 * query the whole string renders as plain text.
 */
export const HighlightedText: React.FC<Props> = ({ text, query }) => {
  const segments = highlightQuery(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.matched ? (
          <strong key={i} className="font-semibold">{seg.text}</strong>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </>
  );
};
