import { Transform, TransformFnParams, Expose } from "class-transformer";
import { applyDecorators } from "./Compose.decorator";

type Transformer<T> = (value: any) => T;

/**
 * 범용 변환 데코레이터 (Expose 포함)
 *
 * @example
 * // 현재 속성명에서 변환
 * @To((v) => v.toUpperCase())
 * name!: string;
 *
 * @example
 * // 다른 필드에서 변환
 * @To('firstPrompt', (v) => v.substring(0, 50) || 'No title')
 * title!: string;
 */
export function To<T>(transformer: Transformer<T>): PropertyDecorator;
export function To<T>(sourceField: string, transformer: Transformer<T>): PropertyDecorator;
export function To<T>(
  sourceFieldOrTransformer: string | Transformer<T>,
  transformer?: Transformer<T>
): PropertyDecorator {
  const sourceField = typeof sourceFieldOrTransformer === 'string' ? sourceFieldOrTransformer : undefined;
  const actualTransformer = typeof sourceFieldOrTransformer === 'function' ? sourceFieldOrTransformer : transformer!;

  return applyDecorators(
    Expose(),
    Transform(({ obj, value, key }: TransformFnParams) => {
      const source = sourceField || key;
      return source in obj ? actualTransformer(obj[source]) : value;
    })
  );
}

/**
 * Date 변환 데코레이터 (Expose 포함)
 * @param sourceField 소스 필드명 (생략 시 현재 속성명 사용)
 *
 * @example
 * @ToDate('created')
 * createdAt!: Date;
 */
export function ToDate(sourceField?: string): PropertyDecorator {
  return sourceField
    ? To(sourceField, (v) => new Date(v))
    : To((v) => new Date(v));
}

/**
 * 필드명 매핑 데코레이터 (Expose 포함, 값 변환 없음)
 * @param sourceField 소스 필드명
 *
 * @example
 * @Rename('sessionId')
 * id!: string;
 */
export function Rename(sourceField: string): PropertyDecorator {
  return To(sourceField, (v) => v);
}
