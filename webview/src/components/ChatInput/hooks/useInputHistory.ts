import { useState, useCallback } from 'react';

interface UseInputHistoryReturn {
  pushToHistory: (value: string) => void;
  navigateUp: (currentValue: string) => string | null;
  navigateDown: () => string | null;
  isEmpty: boolean;
  isNavigating: boolean;
}

export function useInputHistory(): UseInputHistoryReturn {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [unsavedDraft, setUnsavedDraft] = useState<string>('');

  const pushToHistory = useCallback((value: string) => {
    setHistory((prev) => [...prev, value]);
    setHistoryIndex(-1);
    setUnsavedDraft('');
  }, []);

  const navigateUp = useCallback((currentValue: string): string | null => {
    if (history.length === 0) return null;

    const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(historyIndex - 1, 0);
    setHistoryIndex(newIndex);

    if (historyIndex === -1) {
      setUnsavedDraft(currentValue);
    }

    return history[newIndex];
  }, [history, historyIndex]);

  const navigateDown = useCallback((): string | null => {
    if (history.length === 0) return null;
    if (historyIndex === -1) return null;

    const newIndex = historyIndex + 1;

    if (newIndex >= history.length) {
      setHistoryIndex(-1);
      return unsavedDraft;
    } else {
      setHistoryIndex(newIndex);
      return history[newIndex];
    }
  }, [history, historyIndex, unsavedDraft]);

  return {
    pushToHistory,
    navigateUp,
    navigateDown,
    isEmpty: history.length === 0,
    isNavigating: historyIndex !== -1,
  };
}
