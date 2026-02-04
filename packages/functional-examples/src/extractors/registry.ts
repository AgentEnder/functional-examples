/**
 * Registry for metadata extractors
 */

import type { MetadataExtractor, ExtractionContext, ExtractedMetadata } from './types.js';
import { YamlFrontmatterExtractor } from './yaml-frontmatter.js';
import { MetaYmlExtractor } from './meta-yml.js';

/**
 * Registry that holds metadata extractors and dispatches extraction requests.
 * Extractors are tried in registration order; first match wins.
 */
export class ExtractorRegistry {
  private extractors: MetadataExtractor[] = [];

  /**
   * Register a new extractor.
   * @returns this for chaining
   */
  register(extractor: MetadataExtractor): this {
    this.extractors.push(extractor);
    return this;
  }

  /**
   * Get all registered extractors
   */
  getExtractors(): readonly MetadataExtractor[] {
    return this.extractors;
  }

  /**
   * Find the first extractor that can handle the given context
   */
  findExtractor(context: ExtractionContext): MetadataExtractor | undefined {
    return this.extractors.find((e) => e.canExtract(context));
  }

  /**
   * Extract metadata using the first matching extractor.
   * @throws Error if no extractor can handle the context
   */
  async extract(context: ExtractionContext): Promise<ExtractedMetadata> {
    const extractor = this.findExtractor(context);
    if (!extractor) {
      throw new Error(
        `No extractor found for ${context.isDirectory ? 'directory' : 'file'}: ${context.path}`
      );
    }
    return extractor.extract(context);
  }
}

/**
 * Create a registry with the default extractors:
 * - MetaYmlExtractor (for directory-based examples with meta.yml)
 * - YamlFrontmatterExtractor (for single-file examples with YAML frontmatter)
 */
export function createDefaultRegistry(): ExtractorRegistry {
  return new ExtractorRegistry()
    .register(new MetaYmlExtractor())
    .register(new YamlFrontmatterExtractor());
}
