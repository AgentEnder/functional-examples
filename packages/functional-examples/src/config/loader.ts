/**
 * Configuration file discovery and loading
 */

import path from 'node:path';
import { existsSync } from 'node:fs';

import type { Config } from './types.js';

const CONFIG_PATTERNS = [
  'functional-examples.config',
  '.functional-examples',
  'functional-examples',
  '.functional-examplesrc',
] as const;

const SUPPORTED_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.json',
  '.jsonc',
] as const;

export async function findConfigFile(
  cwd: string = process.cwd()
): Promise<string | null> {
  const checkedPaths: string[] = [];

  for (const currentDir of getSearchPath(cwd)) {
    for (const pattern of CONFIG_PATTERNS) {
      for (const ext of SUPPORTED_EXTENSIONS) {
        const configPath = path.join(currentDir, `${pattern}${ext}`);

        checkedPaths.push(configPath);

        if (existsSync(configPath)) {
          return configPath;
        }
      }
    }
  }

  return null;
}

export async function loadConfig<TMetadata = Record<string, unknown>>(
  configPath: string
): Promise<Config<TMetadata>> {
  const ext = path.extname(configPath);

  if (ext === '.json' || ext === '.jsonc') {
    return loadJsonConfig<TMetadata>(configPath);
  }

  return loadTsConfig<TMetadata>(configPath);
}

async function loadJsonConfig<TMetadata>(
  configPath: string
): Promise<Config<TMetadata>> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(configPath, 'utf-8');

  const config = JSON.parse(content);

  return config as Config<TMetadata>;
}

async function loadTsConfig<TMetadata>(
  configPath: string
): Promise<Config<TMetadata>> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
  });

  const module = await jiti.import(configPath);

  // Handle default export or direct config
  const config = (module as { default?: Config<TMetadata> }).default ?? module;

  return config as Config<TMetadata>;
}

function* getSearchPath(cwd: string): Generator<string> {
  let current = path.resolve(cwd);

  while (true) {
    yield current;

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;

    if (
      current === '/' ||
      (process.platform === 'win32' && current.match(/^[A-Z]:\\$/))
    ) {
      break;
    }
  }
}
