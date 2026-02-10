/**
 * Syncs shared metadata fields from the root package.json into each
 * publishable (non-private) package under packages/.
 *
 * Usage:  node scripts/sync-package-metadata.mjs
 *         pnpm sync-metadata
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

/** Fields copied verbatim from root → each package */
const SYNCED_FIELDS = [
  'license',
  'author',
  'homepage',
  'repository',
  'bugs',
  'funding',
  'publishConfig'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

const root = readJson(join(ROOT, 'package.json'));

const packageDirs = readdirSync(PACKAGES_DIR).filter((name) =>
  statSync(join(PACKAGES_DIR, name)).isDirectory()
);

let changed = 0;

for (const dir of packageDirs) {
  const pkgPath = join(PACKAGES_DIR, dir, 'package.json');
  let pkg;
  try {
    pkg = readJson(pkgPath);
  } catch {
    continue; // no package.json in this directory
  }

  if (pkg.private) continue;

  const before = JSON.stringify(pkg);

  for (const field of SYNCED_FIELDS) {
    if (root[field] !== undefined) {
      pkg[field] = structuredClone(root[field]);
    }
  }

  if (JSON.stringify(pkg) !== before) {
    writeJson(pkgPath, pkg);
    changed++;
    console.log(`  updated  ${pkg.name}`);
  } else {
    console.log(`  current  ${pkg.name}`);
  }
}

console.log(
  changed > 0
    ? `\n✓ Synced metadata to ${changed} package(s).`
    : '\n✓ All packages already up to date.'
);
