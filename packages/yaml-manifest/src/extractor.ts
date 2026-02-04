/**
 * Meta.yml extractor for multi-file examples
 *
 * Scans a directory tree for folders containing meta.yml files.
 * Each folder with meta.yml is treated as a multi-file example,
 * where all files in the folder belong to that example.
 */

import { glob } from 'fast-glob';
import { readFile, readdir } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import path from 'node:path';
import type {
  Extractor,
  ExtractorOptions,
  ExtractorResult,
  Example,
  ExampleFile,
  ExtractorError,
} from 'functional-examples';

/**
 * Options for creating a meta.yml extractor
 */
export interface MetaYmlExtractorOptions {
  /**
   * Name of the metadata file to look for.
   * @default 'meta.yml'
   */
  metaFileName?: string;

  /**
   * Files to exclude from the example (besides the meta file).
   * @default []
   */
  excludeFiles?: string[];

  /**
   * Patterns to exclude from file collection within examples.
   * @default ['node_modules/**', '.git/**']
   */
  excludePatterns?: string[];
}

const DEFAULT_OPTIONS: Required<MetaYmlExtractorOptions> = {
  metaFileName: 'meta.yml',
  excludeFiles: [],
  excludePatterns: ['node_modules/**', '.git/**'],
};

/**
 * Create a meta.yml extractor.
 *
 * Scans for directories containing meta.yml files. Each such directory
 * is treated as a multi-file example with all its contents.
 *
 * @example
 * ```typescript
 * import { createMetaYmlExtractor } from '@functional-examples/yaml-manifest';
 *
 * const extractor = createMetaYmlExtractor({
 *   metaFileName: 'meta.yaml', // use different filename
 * });
 *
 * // Use with scanExamples
 * import { scanExamples } from 'functional-examples';
 *
 * const result = await scanExamples({
 *   root: './examples',
 *   extractors: [extractor],
 * });
 * ```
 */
export function createMetaYmlExtractor(
  opts?: MetaYmlExtractorOptions
): Extractor {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  return {
    name: 'meta-yml',

    async extract(
      rootPath: string,
      extractorOpts?: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: ExtractorError[] = [];
      const claimedFiles = new Set<string>();

      // Find all meta.yml files
      const metaFiles = await glob(`**/${options.metaFileName}`, {
        cwd: rootPath,
        absolute: true,
        ignore: extractorOpts?.exclude ?? [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
        ],
      });

      // Process each meta.yml
      for (const metaPath of metaFiles) {
        // Check for abort signal
        if (extractorOpts?.signal?.aborted) {
          break;
        }

        try {
          const exampleDir = path.dirname(metaPath);
          const metaContent = await readFile(metaPath, 'utf-8');
          const metadata = parseYaml(metaContent) as Record<string, unknown>;

          const dirName = path.basename(exampleDir);
          const id = (metadata.id as string) ?? dirName;

          // Collect all files in the directory
          const files = await collectFiles(
            exampleDir,
            [...options.excludeFiles, options.metaFileName],
            options.excludePatterns
          );

          // Claim the meta file and all collected files
          claimedFiles.add(metaPath);
          for (const file of files) {
            claimedFiles.add(file.absolutePath);
          }

          examples.push({
            id,
            title: (metadata.title as string) ?? dirName,
            description: metadata.description as string | undefined,
            rootPath: exampleDir,
            files,
            metadata,
            extractorName: 'meta-yml',
          });
        } catch (error) {
          errors.push({
            path: metaPath,
            message: (error as Error).message,
            cause: error as Error,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}

/**
 * Recursively collect all files in a directory
 */
async function collectFiles(
  dir: string,
  excludeNames: string[],
  excludePatterns: string[]
): Promise<ExampleFile[]> {
  const files: ExampleFile[] = [];

  async function walk(currentDir: string, baseDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip excluded files by name
      if (excludeNames.includes(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Check exclude patterns
      if (
        excludePatterns.some((pattern) => {
          // Simple glob matching
          const regex = new RegExp(
            pattern
              .replace(/\*\*/g, '<<GLOBSTAR>>')
              .replace(/\*/g, '[^/]*')
              .replace(/<<GLOBSTAR>>/g, '.*')
          );
          return regex.test(relativePath);
        })
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath, baseDir);
      } else {
        const raw = await readFile(fullPath, 'utf-8');
        files.push({
          absolutePath: fullPath,
          relativePath,
          raw,
        });
      }
    }
  }

  await walk(dir, dir);
  return files;
}
