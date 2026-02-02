/**
 * Tool use status
 */
export type ToolUseStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'executing'
  | 'completed'
  | 'failed';

/**
 * File operation type
 */
export type FileOperation = 'create' | 'modify' | 'delete';

/**
 * Permission type for tools
 */
export type PermissionType = 'FILE_WRITE' | 'FILE_DELETE' | 'BASH_EXECUTE';

/**
 * Risk level for tools
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
