import { useEffect, useRef, useState } from 'react';
import {
  createThinkingTokenTweener,
  type ThinkingTokenTweener,
} from '@/utils/thinkingTokenTweener';

/**
 * Animates the live thinking-token estimate toward each new target so the count
 * scrolls smoothly instead of jumping in the coarse steps the CLI emits.
 *
 * Mirrors the Claude Code (Cursor/VSCode) extension: whenever the target
 * changes we re-time the tween, and while a target is active we re-sample the
 * interpolated value every 100ms to advance the digits. Pass `undefined` to
 * clear (e.g. when the block is no longer actively thinking).
 */
export function useAnimatedThinkingTokens(target: number | undefined): number | undefined {
  const tweenerRef = useRef<ThinkingTokenTweener | null>(null);
  if (tweenerRef.current === null) tweenerRef.current = createThinkingTokenTweener();
  const tweener = tweenerRef.current;

  const [value, setValue] = useState<number | undefined>(() => tweener.valueAt(Date.now()));

  useEffect(() => {
    tweener.update(target, Date.now());
    setValue(tweener.valueAt(Date.now()));
    if (target === undefined) return;
    const id = setInterval(() => setValue(tweener.valueAt(Date.now())), 100);
    return () => clearInterval(id);
  }, [target, tweener]);

  return value;
}
