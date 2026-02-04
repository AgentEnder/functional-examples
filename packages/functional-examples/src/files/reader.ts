/**
 * File reading utilities for examples
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { extractRegion } from '../regions/index.js';
import type { ExampleFile } from '../types/index.js';

/**
 * Options for reading an example file
 */
export interface ReadFileOptions {
  /** Extract only this region from the file */
  region?: string;
  /** File extension override for region parsing */
  extension?: string;
}

/**
 * Read an example file, optionally extracting a specific region.
 *
 * @param filePath - Path to the file to read
 * @param options - Options including optional region extraction
 * @returns The file contents (or region contents if specified)
 *
 * @example
 * ```typescript
 * // Read entire file
 * const content = await readExampleFile('./examples/basic/main.ts');
 *
 * // Read specific region
 * const setup = await readExampleFile('./examples/basic/main.ts', {
 *   region: 'setup'
 * });
 * ```
 */
export async function readExampleFile(
  filePath: string,
  options: ReadFileOptions = {}
): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');

  if (options.region) {
    const ext = options.extension ?? path.extname(filePath).slice(1);
    return extractRegion(content, options.region, { extension: ext });
  }

  return content;
}

/**
 * Read multiple files from an example directory.
 *
 * @param directory - Base directory for the example
 * @param files - Array of relative file paths to read
 * @returns Array of ExampleFile objects
 *
 * @example
 * ```typescript
 * const files = await readExampleFiles('./examples/multi-file', [
 *   'main.ts',
 *   'helper.ts',
 *   'config.json'
 * ]);
 * ```
 */
export async function readExampleFiles(
  directory: string,
  files: string[]
): Promise<ExampleFile[]> {
  const results: ExampleFile[] = [];

  for (const relativePath of files) {
    const fullPath = path.join(directory, relativePath);
    const raw = await fs.readFile(fullPath, 'utf-8');
    results.push({
      absolutePath: path.resolve(fullPath),
      relativePath,
      raw,
    });
  }

  return results;
}
