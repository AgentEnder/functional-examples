/**
 * Basic example: Scanning for examples in a directory
 */
import { resolveConfig, scanExamples } from 'functional-examples';

// #region scan
async function main() {
  // Resolve config (auto-detects installed plugins)
  const config = await resolveConfig({ root: './examples' });

  // Scan for examples
  const result = await scanExamples(config);

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
