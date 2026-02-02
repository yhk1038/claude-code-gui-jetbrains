import { BridgeClient } from '../bridge/BridgeClient';
import { PermissionType, RiskLevel, FileOperation } from '../../dto/common';

interface FileChangeInfo {
  filePath: string;
  operation: FileOperation;
  content?: string;
  oldContent?: string;
  newContent?: string;
  oldString?: string;
  newString?: string;
}

interface PermissionRequestPayload {
  toolUseId: string;
  toolName: string;
  permissionType: PermissionType;
  riskLevel: RiskLevel;
  fileChange?: FileChangeInfo;
}

interface DiffAvailablePayload {
  toolUseId: string;
  filePath: string;
  operation: string;
  diff: string;
  oldContent?: string;
  newContent?: string;
}

/**
 * Tools API module
 * Handles tool permissions and diff operations
 */
export class ToolsApi {
  constructor(private bridge: BridgeClient) {}

  /**
   * Approve a tool use request
   */
  async approve(toolUseId: string): Promise<void> {
    await this.bridge.request('TOOL_RESPONSE', {
      toolUseId,
      approved: true,
    });
  }

  /**
   * Deny a tool use request
   */
  async deny(toolUseId: string): Promise<void> {
    await this.bridge.request('TOOL_RESPONSE', {
      toolUseId,
      approved: false,
    });
  }

  /**
   * Open diff view in IDE
   */
  async openDiff(
    filePath: string,
    oldContent: string,
    newContent: string
  ): Promise<void> {
    await this.bridge.request('OPEN_DIFF', {
      filePath,
      oldContent,
      newContent,
    });
  }

  /**
   * Apply a diff (accept file changes)
   */
  async applyDiff(
    toolUseId: string,
    options?: {
      filePath?: string;
      content?: string;
      operation?: FileOperation;
    }
  ): Promise<void> {
    await this.bridge.request('APPLY_DIFF', {
      toolUseId,
      ...options,
    });
  }

  /**
   * Reject a diff (decline file changes)
   */
  async rejectDiff(toolUseId: string): Promise<void> {
    await this.bridge.request('REJECT_DIFF', { toolUseId });
  }

  // Event subscriptions

  /**
   * Subscribe to permission requests
   */
  onPermissionRequest(
    callback: (request: PermissionRequestPayload) => void
  ): () => void {
    return this.bridge.subscribe('PERMISSION_REQUEST', (message) => {
      callback(message.payload as unknown as PermissionRequestPayload);
    });
  }

  /**
   * Subscribe to diff available events
   */
  onDiffAvailable(
    callback: (diff: DiffAvailablePayload) => void
  ): () => void {
    return this.bridge.subscribe('DIFF_AVAILABLE', (message) => {
      callback(message.payload as unknown as DiffAvailablePayload);
    });
  }

  /**
   * Subscribe to tool execution completion
   */
  onToolComplete(
    callback: (data: { toolUseId: string; result?: string; error?: string }) => void
  ): () => void {
    return this.bridge.subscribe('TOOL_COMPLETE', (message) => {
      callback({
        toolUseId: message.payload?.toolUseId as string,
        result: message.payload?.result as string | undefined,
        error: message.payload?.error as string | undefined,
      });
    });
  }

  // Utility methods

  /**
   * Get permission type for a tool name
   */
  getPermissionType(toolName: string): PermissionType | null {
    switch (toolName) {
      case 'Write':
      case 'Edit':
        return 'FILE_WRITE';
      case 'Delete':
        return 'FILE_DELETE';
      case 'Bash':
        return 'BASH_EXECUTE';
      default:
        return null;
    }
  }

  /**
   * Get risk level for a tool name
   */
  getRiskLevel(toolName: string): RiskLevel {
    switch (toolName) {
      case 'Bash':
      case 'Delete':
        return 'HIGH';
      case 'Write':
      case 'Edit':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  /**
   * Check if a tool requires permission
   */
  requiresPermission(toolName: string): boolean {
    return this.getPermissionType(toolName) !== null;
  }
}
