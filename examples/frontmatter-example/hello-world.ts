// ---
// id: hello-world
// title: Hello World Example
// description: A simple hello world example demonstrating frontmatter metadata
// tags:
//   - beginner
//   - tutorial
// ---

/**
 * A simple greeting function
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// #region usage
// Usage example
const message = greet('World');
console.log(message);
// #endregion usage
