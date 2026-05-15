import { useState, useCallback } from 'react';

export interface AttachedContext {
  id: string;
  type: 'file' | 'selection' | 'active';
  path: string;
  content?: string;
  startLine?: number;
  endLine?: number;
}

interface UseContextReturn {
  attachedContexts: AttachedContext[];
  addContext: (type: AttachedContext['type'], path: string, content?: string, startLine?: number, endLine?: number) => void;
  removeContext: (id: string) => void;
  clearContexts: () => void;
  hasContext: (path: string, type?: AttachedContext['type']) => boolean;
}

export function useContext(): UseContextReturn {
  const [attachedContexts, setAttachedContexts] = useState<AttachedContext[]>([]);

  const generateContextId = useCallback(() => {
    return `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const addContext = useCallback((
    type: AttachedContext['type'],
    path: string,
    content?: string,
    startLine?: number,
    endLine?: number
  ) => {
    const newContext: AttachedContext = {
      id: generateContextId(),
      type,
      path,
      content,
      startLine,
      endLine,
    };
    const key =
      type === 'selection'
        ? `selection:${path}:${startLine ?? ''}:${endLine ?? ''}:${content ?? ''}`
        : `${type}:${path}`;

    setAttachedContexts(prev => {
      if (prev.some(ctx =>
        (ctx.type === 'selection'
          ? `selection:${ctx.path}:${ctx.startLine ?? ''}:${ctx.endLine ?? ''}:${ctx.content ?? ''}`
          : `${ctx.type}:${ctx.path}`) === key
      )) {
        return prev;
      }
      return [...prev, newContext];
    });
  }, [generateContextId]);

  const removeContext = useCallback((id: string) => {
    setAttachedContexts(prev => prev.filter(ctx => ctx.id !== id));
  }, []);

  const clearContexts = useCallback(() => {
    setAttachedContexts([]);
  }, []);

  const hasContext = useCallback((path: string, type?: AttachedContext['type']) => {
    return attachedContexts.some(ctx =>
      ctx.path === path && (type === undefined || ctx.type === type)
    );
  }, [attachedContexts]);

  return {
    attachedContexts,
    addContext,
    removeContext,
    clearContexts,
    hasContext,
  };
}
