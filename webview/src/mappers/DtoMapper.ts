import { plainToInstance, ClassConstructor } from 'class-transformer';

/**
 * DTO mapping utility class using class-transformer
 */
export class DtoMapper {
  /**
   * Map a plain object to a DTO class instance
   */
  static map<T>(plain: unknown, cls: ClassConstructor<T>): T {
    return plainToInstance(cls, plain, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });
  }

  /**
   * Map an array of plain objects to DTO class instances
   */
  static mapArray<T>(plain: unknown[], cls: ClassConstructor<T>): T[] {
    return plainToInstance(cls, plain, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });
  }

  /**
   * Safely map with error handling - returns null on failure
   */
  static safeMap<T>(plain: unknown, cls: ClassConstructor<T>): T | null {
    try {
      return DtoMapper.map(plain, cls);
    } catch (error) {
      console.error(`Failed to map to ${cls.name}:`, error);
      return null;
    }
  }

  /**
   * Safely map array with error handling - returns empty array on failure
   */
  static safeMapArray<T>(plain: unknown[], cls: ClassConstructor<T>): T[] {
    try {
      return DtoMapper.mapArray(plain, cls);
    } catch (error) {
      console.error(`Failed to map array to ${cls.name}:`, error);
      return [];
    }
  }
}
