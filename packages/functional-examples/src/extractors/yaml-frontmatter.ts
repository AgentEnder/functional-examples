/**
 * YAML frontmatter extractor for single-file examples.
 *
 * Supports frontmatter in comment blocks:
 * ```typescript
 * // ---
 * // title: Example Title
 * // description: What this demonstrates
 * // ---
 * ```
 */

import YAML from 'yaml';
import type { MetadataExtractor, ExtractionContext, ExtractedMetadata } from './types.js';
import path from 'node:path';

/** Pattern to detect frontmatter start */
const FRONTMATTER_START = /^\/\/\s*---\s*$/;
/** Pattern to detect frontmatter end */
const FRONTMATTER_END = /^\/\/\s*---\s*$/;

/**
 * Extractor for YAML frontmatter in single-file examples.
 * Used by cli-forge and flexibench patterns.
 */
export class YamlFrontmatterExtractor implements MetadataExtractor {
  readonly name = 'yaml-frontmatter';

  canExtract(context: ExtractionContext): boolean {
    // Only works on files with content
    if (context.isDirectory || !context.content) {
      return false;
    }

    // Check if first non-empty line is frontmatter start
    const lines = context.content.split('\n');
    const firstLine = lines[0]?.trimEnd();
    return FRONTMATTER_START.test(firstLine ?? '');
  }

  async extract(context: ExtractionContext): Promise<ExtractedMetadata> {
    if (!context.content) {
      throw new Error('No content provided for frontmatter extraction');
    }

    const lines = context.content.split('\n');
    const frontmatterLines: string[] = [];
    let lineIndex = 0;

    // Skip the opening ---
    const firstLine = lines[lineIndex]?.trimEnd();
    if (!firstLine || !FRONTMATTER_START.test(firstLine)) {
      throw new Error('Content does not start with frontmatter marker');
    }
    lineIndex++;

    // Collect frontmatter lines until closing ---
    while (lineIndex < lines.length) {
      const line = lines[lineIndex].trimEnd();
      if (FRONTMATTER_END.test(line)) {
        lineIndex++;
        break;
      }
      // Strip the leading // and optional space
      frontmatterLines.push(line.replace(/^\/\/\s?/, ''));
      lineIndex++;
    }

    // Parse YAML
    const yamlContent = frontmatterLines.join('\n');
    const parsed = YAML.parse(yamlContent) as Record<string, unknown>;

    // Generate ID from filename if not provided
    const filename = path.basename(context.path);
    const defaultId = filename.replace(/\.[^.]+$/, '').replace(/\//g, '-');

    const metadata = {
      id: defaultId,
      title: defaultId,
      ...parsed,
    };

    // Content after frontmatter
    const strippedContent = lines.slice(lineIndex).join('\n');

    return {
      metadata,
      files: [
        {
          path: path.basename(context.path),
          contents: strippedContent,
        },
      ],
      strippedContent,
    };
  }
}
