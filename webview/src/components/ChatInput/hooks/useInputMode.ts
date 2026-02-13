import { useState, useCallback, useEffect, useRef } from 'react';
import { InputMode, MODE_CYCLE } from '../../../types/chatInput';

interface UseInputModeReturn {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  cycleMode: () => void;
}

export function useInputMode(initialMode: InputMode = 'ask_before_edit'): UseInputModeReturn {
  const [mode, setMode] = useState<InputMode>(initialMode);
  const hasUserChanged = useRef(false);

  // 설정에서 초기 모드가 로드되면 동기화 (사용자가 아직 변경하지 않은 경우만)
  useEffect(() => {
    if (!hasUserChanged.current) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const setModeWithTracking = useCallback((newMode: InputMode) => {
    hasUserChanged.current = true;
    setMode(newMode);
  }, []);

  const cycleMode = useCallback(() => {
    hasUserChanged.current = true;
    setMode((current) => {
      const currentIndex = MODE_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
      return MODE_CYCLE[nextIndex];
    });
  }, []);

  return { mode, setMode: setModeWithTracking, cycleMode };
}
