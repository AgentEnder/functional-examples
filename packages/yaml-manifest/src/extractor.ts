/**
 * Meta.yml extractor for multi-file examples
 *
 * Receives candidates (files and directories) and looks for meta.yml files.
 * Each folder with meta.yml is treated as a multi-file example,
 * where all files in the folder belong to that example.
 */

import type {
  Example,
  ExampleFile,
  Extractor,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
} from '@functional-examples/devkit';
import { parseYaml } from '@functional-examples/devkit';
import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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

  async function extractFromManifest(
    metaPath: string,
    exampleDir: string
  ): Promise<{ example: Example; claimedFiles: string[] }> {
    const metaContent = await readFile(metaPath, 'utf-8');
    const metadata = (await parseYaml(metaContent)) as Record<string, unknown>;

    const dirName = path.basename(exampleDir);
    const id = (metadata.id as string) ?? dirName;

    const files = await collectFiles(
      exampleDir,
      [...options.excludeFiles, options.metaFileName],
      options.excludePatterns
    );

    const claimedFiles = [metaPath, ...files.map((f) => f.absolutePath)];

    return {
      example: {
        id,
        title: (metadata.title as string) ?? dirName,
        description: metadata.description as string | undefined,
        rootPath: exampleDir,
        files,
        metadata,
        extractorName: 'meta-yml',
      },
      claimedFiles,
    };
  }

  return {
    name: 'meta-yml',

    async extract(
      candidates: Dirent[],
      extractorOpts: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: ExtractorError[] = [];
      const claimedFiles = new Set<string>();
      // Track processed directories to avoid duplicate extraction
      // (when both directory and meta file are candidates)
      const processedDirs = new Set<string>();

      for (const candidate of candidates) {
        if (extractorOpts.signal?.aborted) break;

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // File candidate: check if it's our meta file
        if (candidate.isFile() && candidate.name === options.metaFileName) {
          const exampleDir = path.dirname(fullPath);
          // Skip if we already processed this directory
          if (processedDirs.has(exampleDir)) continue;

          try {
            const result = await extractFromManifest(fullPath, exampleDir);
            examples.push(result.example);
            result.claimedFiles.forEach((f) => claimedFiles.add(f));
            processedDirs.add(exampleDir);
          } catch (error) {
            errors.push({
              path: fullPath,
              message: (error as Error).message,
              cause: error as Error,
            });
          }
          continue;
        }

        // Directory candidate: look for meta file inside
        if (candidate.isDirectory()) {
          // Skip if we already processed this directory
          if (processedDirs.has(fullPath)) continue;

          const metaPath = path.join(fullPath, options.metaFileName);
          try {
            const result = await extractFromManifest(metaPath, fullPath);
            examples.push(result.example);
            result.claimedFiles.forEach((f) => claimedFiles.add(f));
            processedDirs.add(fullPath);
          } catch {
            // No meta file in this directory, skip silently
          }
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
