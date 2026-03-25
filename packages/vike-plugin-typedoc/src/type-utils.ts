import { ReflectionType, type Type } from 'typedoc';

/**
 * Check if a Type is an empty ReflectionType (no children, no signatures).
 *
 * These are structural artifacts from mapped type utilities like
 * `MakeUndefinedPropertiesOptional` where one branch evaluates to `{}`.
 * Filtering them out produces cleaner type signatures.
 */
export function isEmptyReflectionType(type: Type): boolean {
  if (!(type instanceof ReflectionType)) return false;
  const decl = type.declaration;
  return (
    (!decl.children || decl.children.length === 0) &&
    (!decl.signatures || decl.signatures.length === 0)
  );
}
