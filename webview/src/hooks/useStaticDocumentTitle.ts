import { useEffect } from 'react';

/**
 * Sets `document.title` to a fixed string for pages that have a stable label
 * (e.g. Settings), as opposed to the session-driven `useDocumentTitle`.
 *
 * The JetBrains editor tab derives its label from the WebView's document.title
 * (see ClaudeCodeFileEditor). Pages that never set a title leave JCEF to fall
 * back to the raw URL as the tab label — which is how the Settings tab ended up
 * showing "localhost:PORT/settings...". Setting a title here fixes that.
 *
 * An empty title is ignored so we never clobber an existing label with a blank.
 */
export function useStaticDocumentTitle(title: string) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);
}
