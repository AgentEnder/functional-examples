/**
 * Basic example: Scanning for examples in a directory
 */
import { scanExamples, resolveConfig } from 'functional-examples';

// #region scan
async function main() {
  // Resolve config (auto-detects installed extractors)
  const config = await resolveConfig({});

  // Scan for examples
  const result = await scanExamples({
    root: './examples',
    extractors: config.extractors,
  });

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
// #endregion scan

main().catch(console.error);
