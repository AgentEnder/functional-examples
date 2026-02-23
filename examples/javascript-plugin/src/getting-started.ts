// ---
// id: getting-started
// title: Getting Started
// description: A simple example demonstrating frontmatter metadata extraction
// tags:
//   - beginner
//   - tutorial
// ---

/**
 * A simple greeting function.
 *
 * @param name - The name to greet
 * @returns A greeting message
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// #_region usage
// Example usage of the greet function
const message = greet('World');
console.log(message); // Output: Hello, World!
// #_endregion usage
