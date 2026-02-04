// ---
// id: mixed-utils
// title: Utility Functions
// description: Example using frontmatter in a mixed-plugin project
// ---

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format a date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US').format(date);
}
