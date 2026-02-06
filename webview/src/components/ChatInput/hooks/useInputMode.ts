import { useState, useCallback } from 'react';
import { InputMode, MODE_CYCLE } from '../../../types/chatInput';

interface UseInputModeReturn {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  cycleMode: () => void;
}

export function useInputMode(initialMode: InputMode = 'ask_before_edit'): UseInputModeReturn {
  const [mode, setMode] = useState<InputMode>(initialMode);

  const cycleMode = useCallback(() => {
    setMode((current) => {
      const currentIndex = MODE_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
      return MODE_CYCLE[nextIndex];
    });
  }, []);

  return { mode, setMode, cycleMode };
}
