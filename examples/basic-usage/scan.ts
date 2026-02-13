/**
 * Basic example: Scanning for examples programmatically
 */
import { scan } from 'functional-examples';

// #_region scan
async function main() {
  // scan() auto-discovers config and plugins
  const result = await scan();

  console.log(`Found ${result.examples.length} examples:`);
  for (const example of result.examples) {
    console.log(`  - ${example.title} (${example.id})`);
  }

  if (result.errors.length > 0) {
    console.log(`\n${result.errors.length} errors occurred:`);
    for (const error of result.errors) {
      console.log(`  - ${error.path}: ${error.message}`);
    }
  }
}
// #_endregion scan

main().catch(console.error);
