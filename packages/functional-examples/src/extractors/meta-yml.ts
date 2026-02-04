/**
 * meta.yml extractor for directory-based examples.
 *
 * Expected structure:
 * ```
 * examples/
 *   my-example/
 *     meta.yml
 *     main.ts
 *     helper.ts
 * ```
 */

import YAML from 'yaml';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MetadataExtractor, ExtractionContext, ExtractedMetadata } from './types.js';
import type { ExampleFile } from '../types/index.js';

/**
 * Extractor for directory-based examples with meta.yml.
 * Used by isolated-workers pattern.
 */
export class MetaYmlExtractor implements MetadataExtractor {
  readonly name = 'meta-yml';

  canExtract(context: ExtractionContext): boolean {
    // Must be a directory with meta.yml
    return context.isDirectory && (context.entries?.includes('meta.yml') ?? false);
  }

  async extract(context: ExtractionContext): Promise<ExtractedMetadata> {
    const metaPath = path.join(context.path, 'meta.yml');
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const parsed = YAML.parse(metaContent) as Record<string, unknown>;

    // Generate ID from directory name if not provided
    const dirName = path.basename(context.path);
    const metadata = {
      id: dirName,
      title: dirName,
      ...parsed,
    };

    // Collect all files except meta.yml and any content file
    const contentFileName = (parsed as { contentFile?: string }).contentFile ?? 'content.md';
    const excludedFiles = new Set(['meta.yml', contentFileName]);

    const files: ExampleFile[] = [];
    await this.collectFiles(context.path, context.path, excludedFiles, files);

    return {
      metadata,
      files,
    };
  }

  private async collectFiles(
    rootPath: string,
    currentPath: string,
    excludedFiles: Set<string>,
    collected: ExampleFile[]
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        await this.collectFiles(rootPath, fullPath, excludedFiles, collected);
      } else if (!excludedFiles.has(entry.name)) {
        const contents = await fs.readFile(fullPath, 'utf-8');
        collected.push({
          path: relativePath,
          contents,
        });
      }
    }
  }
}
