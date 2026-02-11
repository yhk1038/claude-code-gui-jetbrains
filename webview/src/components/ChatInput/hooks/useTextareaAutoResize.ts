import { useEffect, RefObject } from 'react';

interface UseTextareaAutoResizeOptions {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  maxHeight?: number;
}

export function useTextareaAutoResize({
  textareaRef,
  value,
  maxHeight = 200,
}: UseTextareaAutoResizeOptions): void {
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, textareaRef, maxHeight]);
}
