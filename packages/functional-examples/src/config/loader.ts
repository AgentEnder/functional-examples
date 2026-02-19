/**
 * Configuration file discovery and loading
 */

import { existsSync } from 'node:fs';
import path, { dirname } from 'node:path';

import { parseJson } from '@functional-examples/devkit';
import type { Config, ConfigWithRoot } from './types.js';

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

export async function loadConfig(
  configPath: string
): Promise<ConfigWithRoot> {
  const ext = path.extname(configPath);

  if (ext === '.json' || ext === '.jsonc') {
    return loadJsonConfig(configPath);
  }

  return loadTsConfig(configPath);
}

async function loadJsonConfig(configPath: string): Promise<ConfigWithRoot> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(configPath, 'utf-8');

  const config: Config = await parseJson(content, configPath);
  const configDir = dirname(configPath);
  const root = config.root ? path.resolve(configDir, config.root) : configDir;

  return {
    ...config,
    root,
  };
}

async function loadTsConfig(configPath: string): Promise<ConfigWithRoot> {
  const { createJiti } = await import('jiti');
  // Use config file path as base for module resolution
  // This ensures workspace packages can be resolved from the config's location
  const jiti = createJiti(configPath, {
    interopDefault: true,
  });

  const module = await jiti.import(configPath);

  // Handle default export or direct config
  const config = (
    (module as { default?: Config }).default ?? module
  ) as Config;
  const configDir = dirname(configPath);
  const root = config.root ? path.resolve(configDir, config.root) : configDir;

  return {
    ...config,
    root,
  };
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
