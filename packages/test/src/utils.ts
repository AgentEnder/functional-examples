export function typedFilter<T, S extends T>(
  arr: T[],
  predicate: (item: T) => item is S
): S[] {
  return arr.filter(predicate) as S[];
}
