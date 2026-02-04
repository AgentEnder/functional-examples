// ---
// id: utility-functions
// title: Utility Functions
// description: Common utility functions for string manipulation
// ---

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverse a string
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
