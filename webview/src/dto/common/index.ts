import { plainToInstance, ClassConstructor, ClassTransformOptions } from 'class-transformer';

const defaultTransformOptions: ClassTransformOptions = {
  excludeExtraneousValues: false,
  enableImplicitConversion: true,
};

/**
 * plainToInstance 래퍼 - 기본 옵션 적용
 */
export function toInstance<T, V>(
  cls: ClassConstructor<T>,
  plain: V,
  options?: ClassTransformOptions
): T {
  return plainToInstance(cls, plain, { ...defaultTransformOptions, ...options });
}

/**
 * Tool use status
 */
export enum ToolUseStatus {
  Pending = 'pending',
  Approved = 'approved',
  Denied = 'denied',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * File operation type
 */
export enum FileOperation {
  Create = 'create',
  Modify = 'modify',
  Delete = 'delete',
}

/**
 * Permission type for tools
 */
export enum PermissionType {
  FileWrite = 'FILE_WRITE',
  FileDelete = 'FILE_DELETE',
  BashExecute = 'BASH_EXECUTE',
}

/**
 * Risk level for tools
 */
export enum RiskLevel {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
}

/**
 * Message role
 */
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
}

/**
 * Loaded message type (JSONL line type)
 */
export enum LoadedMessageType {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
  Result = 'result',
  Progress = 'progress',
  Summary = 'summary',
}
