/**
 * File reading utilities for examples
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ExampleFile } from '../types/index.js';

/**
 * Read an example file's contents.
 *
 * @param filePath - Path to the file to read
 * @returns The file contents
 *
 * @example
 * ```typescript
 * const content = await readExampleFile('./examples/basic/main.ts');
 * ```
 */
export async function readExampleFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
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
    results.push(
      new ExampleFile({ absolutePath: path.resolve(fullPath), relativePath, raw })
    );
  }

  return results;
}
