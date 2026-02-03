/**
 * 여러 데코레이터를 하나로 합성
 *
 * @example
 * @applyDecorators(Expose(), ToDate('created'))
 * createdAt!: Date;
 */
export function applyDecorators(
  ...decorators: PropertyDecorator[]
): PropertyDecorator {
  return (target, propertyKey) => {
    decorators
      .slice()
      .reverse()
      .forEach((decorator) => decorator(target, propertyKey));
  };
}
