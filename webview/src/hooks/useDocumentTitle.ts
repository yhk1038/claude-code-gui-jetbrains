import { useEffect } from 'react';

/**
 * Hook to update the document title based on the current session.
 * @param title - The session title or null for default "Claude Code"
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title || 'Claude Code';
  }, [title]);
}
