// ---
// id: missing-fields
// title: Missing Required Fields
// description: This example is missing category and difficulty
// ---

/**
 * This example will produce validation errors because
 * it's missing the required `category` and `difficulty` fields.
 *
 * Run `npx functional-examples scan .` to see the validation errors.
 */
export function example() {
  console.log('This example is missing required metadata!');
}
