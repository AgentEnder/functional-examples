// ---
// id: utility-functions
// title: Utility Functions
// description: Common utility functions demonstrating region markers
// ---

// #_region capitalize
/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
// #_endregion capitalize

// #_region reverse
/**
 * Reverse a string.
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
// #_endregion reverse

// #_region truncate
/**
 * Truncate a string to a maximum length.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
// #_endregion truncate
