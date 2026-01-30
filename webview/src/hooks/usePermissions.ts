import { useCallback, useState } from 'react';
import { ToolUse } from '../types';

export type PermissionRiskLevel = 'low' | 'medium' | 'high';

export interface PermissionRequest {
  toolUse: ToolUse;
  riskLevel: PermissionRiskLevel;
  description: string;
  details?: string;
}

interface SessionPermission {
  toolName: string;
  grantedAt: number;
}

interface UsePermissionsReturn {
  pendingRequests: PermissionRequest[];
  sessionPermissions: SessionPermission[];
  requestPermission: (toolUse: ToolUse) => void;
  approvePermission: (toolId: string, allowForSession?: boolean) => void;
  denyPermission: (toolId: string) => void;
  hasSessionPermission: (toolName: string) => boolean;
  clearSessionPermissions: () => void;
}

// Tool risk assessment based on capabilities
function assessRiskLevel(toolName: string, input: Record<string, unknown>): PermissionRiskLevel {
  // High risk operations
  if (toolName === 'bash' || toolName === 'execute_command') {
    return 'high';
  }
  if (toolName === 'delete_file' || toolName === 'write_file') {
    // Check if it's a critical system file
    const path = input.path as string || input.file_path as string;
    if (path?.includes('/etc/') || path?.includes('/System/') || path?.includes('C:\\Windows\\')) {
      return 'high';
    }
    return 'medium';
  }
  if (toolName === 'network_request' || toolName === 'fetch') {
    return 'medium';
  }

  // Low risk operations (read-only)
  return 'low';
}

// Generate human-readable descriptions
function generateDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'bash':
    case 'execute_command':
      return `Execute command: ${input.command || 'Unknown'}`;
    case 'write_file':
      return `Write to file: ${input.path || input.file_path || 'Unknown'}`;
    case 'delete_file':
      return `Delete file: ${input.path || input.file_path || 'Unknown'}`;
    case 'read_file':
      return `Read file: ${input.path || input.file_path || 'Unknown'}`;
    case 'network_request':
      return `Make network request to: ${input.url || 'Unknown'}`;
    case 'list_directory':
      return `List directory: ${input.path || 'Unknown'}`;
    default:
      return `Use tool: ${toolName}`;
  }
}

function generateDetails(toolName: string): string {
  switch (toolName) {
    case 'bash':
    case 'execute_command':
      return 'This will execute a shell command with full system access. The command can modify files, install software, or access network resources.';
    case 'write_file':
      return 'This will write content to a file on your filesystem. Existing content will be overwritten if the file already exists.';
    case 'delete_file':
      return 'This will permanently delete a file from your filesystem. This action cannot be undone.';
    case 'network_request':
      return 'This will make an external network request. Data may be sent to or received from external servers.';
    default:
      return 'This tool will perform an operation that requires your permission.';
  }
}

export function usePermissions(
  approveToolUse: (toolId: string) => void,
  denyToolUse: (toolId: string) => void
): UsePermissionsReturn {
  const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);
  const [sessionPermissions, setSessionPermissions] = useState<SessionPermission[]>([]);

  const requestPermission = useCallback((toolUse: ToolUse) => {
    const riskLevel = assessRiskLevel(toolUse.name, toolUse.input);
    const description = generateDescription(toolUse.name, toolUse.input);
    const details = generateDetails(toolUse.name);

    setPendingRequests(prev => [...prev, {
      toolUse,
      riskLevel,
      description,
      details,
    }]);
  }, []);

  const approvePermission = useCallback((toolId: string, allowForSession = false) => {
    const request = pendingRequests.find(r => r.toolUse.id === toolId);
    if (!request) return;

    // Grant session permission if requested
    if (allowForSession) {
      setSessionPermissions(prev => [...prev, {
        toolName: request.toolUse.name,
        grantedAt: Date.now(),
      }]);
    }

    // Remove from pending and approve
    setPendingRequests(prev => prev.filter(r => r.toolUse.id !== toolId));
    approveToolUse(toolId);
  }, [pendingRequests, approveToolUse]);

  const denyPermission = useCallback((toolId: string) => {
    setPendingRequests(prev => prev.filter(r => r.toolUse.id !== toolId));
    denyToolUse(toolId);
  }, [denyToolUse]);

  const hasSessionPermission = useCallback((toolName: string) => {
    return sessionPermissions.some(p => p.toolName === toolName);
  }, [sessionPermissions]);

  const clearSessionPermissions = useCallback(() => {
    setSessionPermissions([]);
  }, []);

  return {
    pendingRequests,
    sessionPermissions,
    requestPermission,
    approvePermission,
    denyPermission,
    hasSessionPermission,
    clearSessionPermissions,
  };
}
