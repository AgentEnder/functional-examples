/**
 * Scan script using the custom TOML extractor.
 */
import { resolveConfig, scanExamples } from 'functional-examples';
import { createTomlExtractor } from './toml-extractor.js';

async function main() {
  const jsonOutput = process.argv.includes('--json');

  const config = await resolveConfig({
    root: '.',
    plugins: [
      {
        name: 'toml-extractor',
        extractor: createTomlExtractor(),
      },
    ],
    scan: {
      include: ['**/*'],
      exclude: ['**/node_modules/**'],
    },
  });

  const result = await scanExamples(config);

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          examples: result.examples.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            files: e.files.map((f) => f.relativePath),
            metadata: e.metadata,
          })),
          errors: result.errors,
          stats: result.stats,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Found ${result.examples.length} TOML example(s):\n`);
    for (const example of result.examples) {
      console.log(`  ${example.id}: ${example.title}`);
      if (example.description) {
        console.log(`    ${example.description}`);
      }
      console.log(
        `    Files: ${example.files.map((f) => f.relativePath).join(', ')}`
      );
      console.log();
    }

    if (result.errors.length > 0) {
      console.log(`Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error.path}: ${error.message}`);
      }
    }
  }
}

main().catch(console.error);
