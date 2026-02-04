/**
 * Example scanner for discovering examples in a directory
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Example, BaseMetadata, ScanOptions, ScanResult, ScanError } from '../types/index.js';
import { ExtractorRegistry, createDefaultRegistry } from '../extractors/index.js';
import type { ExtractionContext } from '../extractors/types.js';

/**
 * Options for ExampleScanner
 */
export interface ExampleScannerOptions {
  /** Custom extractor registry (uses default if not provided) */
  extractors?: ExtractorRegistry;
  /** File extensions to consider for single-file examples */
  fileExtensions?: string[];
}

/**
 * Scanner for discovering code examples in a directory.
 *
 * Supports two patterns:
 * 1. Directory-based: Folder with meta.yml
 * 2. File-based: Single file with YAML frontmatter
 */
export class ExampleScanner {
  private registry: ExtractorRegistry;
  private fileExtensions: Set<string>;

  constructor(options: ExampleScannerOptions = {}) {
    this.registry = options.extractors ?? createDefaultRegistry();
    this.fileExtensions = new Set(
      options.fileExtensions ?? ['.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go']
    );
  }

  /**
   * Scan a directory for examples
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const { directory, recursive = true, include, exclude } = options;
    const examples: Example[] = [];
    const errors: ScanError[] = [];

    await this.scanDirectory(
      directory,
      directory,
      recursive,
      include,
      exclude,
      examples,
      errors
    );

    return { examples, errors };
  }

  private async scanDirectory(
    rootDir: string,
    currentDir: string,
    recursive: boolean,
    include: string[] | undefined,
    exclude: string[] | undefined,
    examples: Example[],
    errors: ScanError[]
  ): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      errors.push({
        path: currentDir,
        message: `Failed to read directory: ${(error as Error).message}`,
        cause: error instanceof Error ? error : undefined,
      });
      return;
    }

    const entryNames = entries.map((e) => e.name);

    // Check if this directory is an example (has meta.yml)
    if (entryNames.includes('meta.yml')) {
      const context: ExtractionContext = {
        path: currentDir,
        isDirectory: true,
        entries: entryNames,
      };

      const extractor = this.registry.findExtractor(context);
      if (extractor) {
        try {
          const extracted = await extractor.extract(context);
          examples.push({
            metadata: extracted.metadata as BaseMetadata,
            files: extracted.files,
            rootPath: currentDir,
            multiFile: true,
          });
        } catch (error) {
          errors.push({
            path: currentDir,
            message: `Failed to extract metadata: ${(error as Error).message}`,
            cause: error instanceof Error ? error : undefined,
          });
        }
        // Don't recurse into example directories
        return;
      }
    }

    // Process entries
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      // Check exclude patterns
      if (exclude && this.matchesPatterns(relativePath, exclude)) {
        continue;
      }

      // Check include patterns (if specified, only include matching)
      if (include && !this.matchesPatterns(relativePath, include)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (recursive) {
          await this.scanDirectory(
            rootDir,
            fullPath,
            recursive,
            include,
            exclude,
            examples,
            errors
          );
        }
      } else if (entry.isFile()) {
        // Check if it's a file we should examine
        const ext = path.extname(entry.name);
        if (!this.fileExtensions.has(ext)) {
          continue;
        }

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const context: ExtractionContext = {
            path: fullPath,
            isDirectory: false,
            content,
          };

          const extractor = this.registry.findExtractor(context);
          if (extractor) {
            const extracted = await extractor.extract(context);
            examples.push({
              metadata: extracted.metadata as BaseMetadata,
              files: extracted.files,
              rootPath: path.dirname(fullPath),
              multiFile: false,
            });
          }
        } catch (error) {
          // Only report as error if file looked like it should be an example
          // (has frontmatter markers, etc.)
          if (
            error instanceof Error &&
            !error.message.includes('does not start with frontmatter')
          ) {
            errors.push({
              path: fullPath,
              message: `Failed to process file: ${error.message}`,
              cause: error,
            });
          }
        }
      }
    }
  }

  /**
   * Simple glob-style pattern matching
   */
  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.matchesPattern(filePath, pattern));
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob to regex (simple implementation)
    const regexPattern = pattern
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

/**
 * Convenience function to scan a directory for examples.
 *
 * @param directory - Directory to scan
 * @param options - Additional scan options
 * @returns Scan result with examples and errors
 *
 * @example
 * ```typescript
 * const { examples, errors } = await scanExamples('./examples');
 *
 * for (const example of examples) {
 *   console.log(example.metadata.title);
 * }
 * ```
 */
export async function scanExamples(
  directory: string,
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> {
  const scanner = new ExampleScanner();
  return scanner.scan({
    directory,
    ...options,
  });
}
