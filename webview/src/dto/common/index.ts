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
