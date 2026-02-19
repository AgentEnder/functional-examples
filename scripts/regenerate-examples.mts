/**
 * Regenerates the .functional-examples folder inside each example project.
 *
 * Usage:
 *   tsx scripts/regenerate-examples.mts
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from 'functional-examples';

const workspaceRoot = resolve(fileURLToPath(import.meta.url), '../../');

async function main() {
  const { examples } = await scan({ root: workspaceRoot });

  if (examples.length === 0) {
    console.log('No examples found.');
    process.exit(0);
  }

  console.log(`Regenerating ${examples.length} examples...\n`);

  let failed = 0;
  for (const example of examples) {
    process.stdout.write(`  Generating ${example.id}... `);
    try {
      execSync('npx functional-examples generate', {
        cwd: example.rootPath,
        stdio: 'pipe',
      });
      console.log('✓');
    } catch (err) {
      console.log('✗');
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    Error: ${message}\n`);
      failed++;
    }
  }

  console.log(`\nDone. ${examples.length - failed}/${examples.length} succeeded.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
