// ---
// id: ci-example
// title: CI Example
// description: A minimal example for CI testing
// tags:
//   - ci
// ---

/**
 * Simple function to validate in CI.
 */
export function add(a: number, b: number): number {
  return a + b;
}

console.log('add(2, 3) =', add(2, 3));
