/**
 * A Map that automatically creates default values when accessing missing keys.
 *
 * @example
 * ```typescript
 * const countsByCategory = new DefaultMap<string, number[]>(() => []);
 * countsByCategory.get('fruits').push(1); // No need to check if key exists
 * countsByCategory.get('fruits').push(2);
 * console.log(countsByCategory.get('fruits')); // [1, 2]
 * ```
 */
export class DefaultMap<K, V> extends Map<K, V> {
  constructor(private defaultValueBuilder: () => V) {
    super();
  }

  /**
   * Gets the value for a key. If the key doesn't exist, creates a default value,
   * stores it, and returns it.
   */
  override get(key: K): V {
    const inMap = super.get(key);
    if (inMap !== undefined) {
      return inMap;
    }
    const defaultValue = this.defaultValueBuilder();
    super.set(key, defaultValue);
    return defaultValue;
  }
}
