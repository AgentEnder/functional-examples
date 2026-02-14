// ---
// id: snapshot-greeting
// title: Greeting Function
// description: A simple greeting example for snapshot testing
// tags:
//   - beginner
//   - function
// ---

// #_region greet
/**
 * Generate a greeting message.
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
// #_endregion greet

// #_region usage
const result = greet('World');
console.log(result);
// #_endregion usage
