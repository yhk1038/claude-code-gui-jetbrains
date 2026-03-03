import { useCallback, useState } from 'react';
import { ToolUse } from '../types';
import { ToolUseStatus } from '../dto/common';

interface UseToolsReturn {
  toolUses: ToolUse[];
  pendingPermissions: ToolUse[];
  addToolUse: (toolUse: Omit<ToolUse, 'status'>) => void;
  approveToolUse: (toolId: string) => void;
  denyToolUse: (toolId: string) => void;
  updateToolUse: (toolId: string, updates: Partial<ToolUse>) => void;
  clearToolUses: () => void;
  getToolUseById: (toolId: string) => ToolUse | undefined;
}

export function useTools(): UseToolsReturn {
  const [toolUses, setToolUses] = useState<ToolUse[]>([]);

  const addToolUse = useCallback((toolUse: Omit<ToolUse, 'status'>) => {
    const newToolUse: ToolUse = {
      ...toolUse,
      status: ToolUseStatus.Pending,
    };
    setToolUses(prev => [...prev, newToolUse]);
  }, []);

  const approveToolUse = useCallback((toolId: string) => {
    setToolUses(prev => prev.map(t =>
      t.id === toolId ? { ...t, status: ToolUseStatus.Approved } : t
    ));
  }, []);

  const denyToolUse = useCallback((toolId: string) => {
    setToolUses(prev => prev.map(t =>
      t.id === toolId ? { ...t, status: ToolUseStatus.Denied } : t
    ));
  }, []);

  const updateToolUse = useCallback((toolId: string, updates: Partial<ToolUse>) => {
    setToolUses(prev => prev.map(t =>
      t.id === toolId ? { ...t, ...updates } : t
    ));
  }, []);

  const clearToolUses = useCallback(() => {
    setToolUses([]);
  }, []);

  const getToolUseById = useCallback((toolId: string) => {
    return toolUses.find(t => t.id === toolId);
  }, [toolUses]);

  const pendingPermissions = toolUses.filter(t => t.status === ToolUseStatus.Pending);

  return {
    toolUses,
    pendingPermissions,
    addToolUse,
    approveToolUse,
    denyToolUse,
    updateToolUse,
    clearToolUses,
    getToolUseById,
  };
}
