import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/contexts/ApiContext';
import { getBridgeClient } from '@/api/bridge/BridgeClient';

export type PermissionRiskLevel = 'low' | 'medium' | 'high';

export interface PendingPermission {
  controlRequestId: string;
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  riskLevel: PermissionRiskLevel;
  description: string;
}

function assessRiskLevel(toolName: string, input: Record<string, unknown>): PermissionRiskLevel {
  if (toolName === 'Bash') return 'high';
  if (toolName === 'Write' || toolName === 'Edit') {
    const path = (input.file_path as string) || (input.path as string) || '';
    if (path.includes('/etc/') || path.includes('/System/') || path.includes('C:\\Windows\\')) {
      return 'high';
    }
    return 'medium';
  }
  if (toolName === 'Delete') return 'high';
  return 'low';
}

function generateDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return `Execute: ${(input.command as string) || 'Unknown command'}`;
    case 'Write':
      return `Write file: ${(input.file_path as string) || 'Unknown'}`;
    case 'Edit':
      return `Edit file: ${(input.file_path as string) || 'Unknown'}`;
    case 'Delete':
      return `Delete file: ${(input.file_path as string) || 'Unknown'}`;
    case 'Read':
      return `Read file: ${(input.file_path as string) || 'Unknown'}`;
    case 'Glob':
      return `Search files: ${(input.pattern as string) || 'Unknown'}`;
    case 'Grep':
      return `Search content: ${(input.pattern as string) || 'Unknown'}`;
    case 'WebFetch':
      return `Fetch URL: ${(input.url as string) || 'Unknown'}`;
    case 'WebSearch':
      return `Web search: ${(input.query as string) || 'Unknown'}`;
    case 'NotebookEdit':
      return `Edit notebook: ${(input.notebook_path as string) || 'Unknown'}`;
    default:
      return `Use tool: ${toolName}`;
  }
}

export function usePendingPermissions(): {
  pending: PendingPermission | null;
  approve: (controlRequestId: string) => void;
  deny: (controlRequestId: string) => void;
} {
  const api = useApi();
  const [requests, setRequests] = useState<PendingPermission[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to CLI_EVENT for control_request (non-AskUserQuestion tools)
  useEffect(() => {
    const bridge = getBridgeClient();
    const unsubscribe = bridge.subscribe('CLI_EVENT', (message) => {
      const cliEvent = message.payload as any;
      if (cliEvent?.type !== 'control_request') return;

      const request = cliEvent?.request;

      // Skip AskUserQuestion (handled by usePendingAskUserQuestion)
      if (!request || request.subtype !== 'can_use_tool' || request.tool_name === 'AskUserQuestion') {
        return;
      }

      const controlRequestId = cliEvent.request_id as string;
      const toolName = request.tool_name as string;
      const toolUseId = request.tool_use_id as string;
      const input = (request.input || {}) as Record<string, unknown>;

      if (!controlRequestId || processedIdsRef.current.has(controlRequestId)) return;

      setRequests(prev => [...prev, {
        controlRequestId,
        toolName,
        toolUseId,
        input,
        riskLevel: assessRiskLevel(toolName, input),
        description: generateDescription(toolName, input),
      }]);
    });
    return unsubscribe;
  }, []);

  const approve = useCallback((controlRequestId: string) => {
    const req = requests.find(r => r.controlRequestId === controlRequestId);
    if (!req) return;

    processedIdsRef.current.add(controlRequestId);

    api.tools.approve(req.toolUseId, controlRequestId);
    setRequests(prev => prev.filter(r => r.controlRequestId !== controlRequestId));
  }, [requests, api.tools]);

  const deny = useCallback((controlRequestId: string) => {
    const req = requests.find(r => r.controlRequestId === controlRequestId);
    if (!req) return;

    processedIdsRef.current.add(controlRequestId);

    api.tools.deny(req.toolUseId, controlRequestId);
    setRequests(prev => prev.filter(r => r.controlRequestId !== controlRequestId));
  }, [requests, api.tools]);

  // Return the first pending request (FIFO)
  const pending = requests.length > 0 ? requests[0] : null;

  return { pending, approve, deny };
}
