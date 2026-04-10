/**
 * Strict-access metadata proxy — wraps a metadata record so that accessing
 * an undefined property throws a descriptive error instead of silently
 * returning `undefined`.
 *
 * Nested plain objects are recursively proxied so the guarantee holds at
 * every depth:
 *
 * ```markdown
 * <%%= metadata.category %>         <!-- OK if "category" exists -->
 * <%%= metadata.nested.field %>     <!-- OK if "nested.field" exists -->
 * <%%= metadata.typo %>             <!-- throws with available keys -->
 * ```
 */

/**
 * Properties that JS runtimes, template engines, or promise machinery may
 * probe on any object.  These must never trigger a "not defined" error.
 */
const PASSTHROUGH_PROPS = new Set([
  'then',        // Promise/thenable detection
  'toJSON',      // JSON.stringify
  'nodeType',    // DOM-node sniffing (some renderers)
  '$$typeof',    // React element detection
  'asymmetricMatch', // Vitest/Jest matcher protocol
]);

/**
 * Create a strict-access proxy over a metadata record.
 *
 * @param metadata - The plain metadata object to wrap.
 * @param path     - Dot-path prefix used in error messages (e.g. `"metadata"`
 *                   at the top level, `"metadata.docs"` one level down).
 * @returns A `Proxy` that throws on access to undefined own properties.
 */
export function createMetadataProxy(
  metadata: Record<string, unknown>,
  path = 'metadata'
): Record<string, unknown> {
  return new Proxy(metadata, {
    get(target, prop, receiver) {
      // Symbols (iterators, toPrimitive, toStringTag, …) always pass through.
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }

      // Own property — return the value, recursively proxying nested objects.
      if (Object.prototype.hasOwnProperty.call(target, prop)) {
        const value = target[prop];
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          return createMetadataProxy(
            value as Record<string, unknown>,
            `${path}.${prop}`
          );
        }
        return value;
      }

      // Standard Object.prototype members (toString, valueOf, constructor, …).
      if (prop in Object.prototype) {
        return Reflect.get(target, prop, receiver);
      }

      // Engine / framework probes that should silently return undefined.
      if (PASSTHROUGH_PROPS.has(prop)) {
        return undefined;
      }

      // Anything else is a genuine typo / missing-field error.
      const available = Object.keys(target);
      const keyList =
        available.length > 0 ? available.join(', ') : '(none)';
      throw new Error(
        `${path}.${prop} is not defined. Available properties: ${keyList}`
      );
    },
  });
}
