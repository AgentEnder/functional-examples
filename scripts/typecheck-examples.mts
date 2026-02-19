/**
 * Typechecks each example project. Reports an error for any example
 * that is missing a tsconfig.json.
 *
 * Usage:
 *   tsx scripts/typecheck-examples.mts
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from 'functional-examples';

const workspaceRoot = resolve(fileURLToPath(import.meta.url), '../../');

async function main() {
  const { examples } = await scan({ root: workspaceRoot });

  if (examples.length === 0) {
    console.log('No examples found.');
    process.exit(0);
  }

  console.log(`Typechecking ${examples.length} examples...\n`);

  let failed = 0;
  for (const example of examples) {
    process.stdout.write(`  Checking ${example.id}... `);
    const tsconfig = join(example.rootPath, 'tsconfig.json');
    if (!existsSync(tsconfig)) {
      console.log('✗ (no tsconfig.json)');
      failed++;
      continue;
    }
    try {
      execSync('tsc --noEmit', { cwd: example.rootPath, stdio: 'pipe' });
      console.log('✓');
    } catch (err: unknown) {
      console.log('✗');
      const output =
        err instanceof Error && 'stdout' in err
          ? (err as NodeJS.ErrnoException & { stdout: Buffer }).stdout?.toString()
          : String(err);
      if (output) console.error(output.trim().replace(/^/gm, '    '));
      failed++;
    }
  }

  console.log(`\nDone. ${examples.length - failed}/${examples.length} passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
