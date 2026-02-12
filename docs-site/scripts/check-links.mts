/**
 * Cross-platform link checker for the docs site.
 *
 * Copies the built site into a temporary directory structure that mirrors
 * the deployed base path, then runs hyperlink against it.
 *
 * Usage:
 *   tsx docs-site/scripts/check-links.mts
 */

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const tmpDir = resolve(projectRoot, 'tmp', 'functional-examples');
const distClient = resolve(projectRoot, 'dist', 'client');

// Clean and recreate tmp directory
rmSync(resolve(projectRoot, 'tmp'), { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

// Copy built site into the nested tmp path
cpSync(distClient, tmpDir, { recursive: true });

// Run hyperlink against the tmp directory
execSync('pnpm hyperlink ./tmp', {
  cwd: projectRoot,
  stdio: 'inherit',
});
