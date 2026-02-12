/**
 * Hydrate README.md files from README.md.template files.
 *
 * Scans for .template files at the workspace root and under packages/,
 * renders them through the Eta-based guide renderer (expanding example
 * references like `<%= example('id').file('path') %>`), and writes the
 * output as the corresponding README.md.
 *
 * Usage:
 *   tsx scripts/hydrate-readmes.ts          # generate README.md files
 *   tsx scripts/hydrate-readmes.ts --check  # CI mode — exit 1 if stale
 */

import { createGuideRenderer } from '@functional-examples/documentation';
import {
  findConfigFile,
  loadConfig,
  resolveConfig,
  scanExamples,
} from 'functional-examples';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

const isCheck = process.argv.includes('--check');

async function findTemplates(): Promise<
  { templatePath: string; outputPath: string }[]
> {
  const templates: { templatePath: string; outputPath: string }[] = [];

  // Check root
  const rootTemplate = join(workspaceRoot, 'README.md.template');
  try {
    await readFile(rootTemplate);
    templates.push({
      templatePath: rootTemplate,
      outputPath: join(workspaceRoot, 'README.md'),
    });
  } catch {
    // No root template
  }

  // Check packages/*/
  const packagesDir = join(workspaceRoot, 'packages');
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(packagesDir, { withFileTypes: true });
  } catch {
    return templates;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const templatePath = join(packagesDir, entry.name, 'README.md.template');
    try {
      await readFile(templatePath);
      templates.push({
        templatePath,
        outputPath: join(packagesDir, entry.name, 'README.md'),
      });
    } catch {
      // No template for this package
    }
  }

  return templates;
}

async function main() {
  // Scan examples so the guide renderer can resolve references
  const configPath = await findConfigFile(workspaceRoot);
  if (!configPath) {
    console.error('No functional-examples config found at workspace root');
    process.exit(1);
  }

  const rawConfig = await loadConfig(configPath);
  const resolved = await resolveConfig(rawConfig);
  const { examples } = await scanExamples(resolved);

  const renderer = createGuideRenderer(examples);
  const templates = await findTemplates();

  if (templates.length === 0) {
    console.log('No README.md.template files found');
    return;
  }

  console.log(`Found ${templates.length} template(s)`);

  const staleFiles: string[] = [];

  for (const { templatePath, outputPath } of templates) {
    const templateContent = await readFile(templatePath, 'utf-8');
    let rendered: string;

    try {
      rendered = renderer.render(templateContent);
    } catch (err) {
      console.error(
        `Failed to render ${templatePath}:`,
        (err as Error).message
      );
      process.exit(1);
    }

    if (isCheck) {
      let existing = '';
      try {
        existing = await readFile(outputPath, 'utf-8');
      } catch {
        // File doesn't exist
      }

      if (existing !== rendered) {
        const rel =
          outputPath.replace(workspaceRoot + '/', '');
        staleFiles.push(rel);
        console.error(`  STALE: ${rel}`);
      } else {
        const rel =
          outputPath.replace(workspaceRoot + '/', '');
        console.log(`  OK: ${rel}`);
      }
    } else {
      await writeFile(outputPath, rendered, 'utf-8');
      const rel =
        outputPath.replace(workspaceRoot + '/', '');
      console.log(`  Wrote: ${rel}`);
    }
  }

  if (isCheck && staleFiles.length > 0) {
    console.error(
      `\n${staleFiles.length} README(s) are out of date. Run \`tsx scripts/hydrate-readmes.ts\` to regenerate.`
    );
    process.exit(1);
  }

  if (isCheck) {
    console.log('\nAll READMEs are up to date.');
  } else {
    console.log(`\nDone. ${templates.length} README(s) hydrated.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
