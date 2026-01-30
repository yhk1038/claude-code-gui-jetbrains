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
    // Check if context already exists
    setAttachedContexts(prev => {
      const exists = prev.some(ctx => ctx.path === path && ctx.type === type);
      if (exists) return prev;

      const newContext: AttachedContext = {
        id: generateContextId(),
        type,
        path,
        content,
        startLine,
        endLine,
      };

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
