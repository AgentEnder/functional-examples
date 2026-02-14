/**
 * A simple example discovered by the custom INI plugin.
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('INI World'));
