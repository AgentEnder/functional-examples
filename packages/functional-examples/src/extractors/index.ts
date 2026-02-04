/**
 * Metadata extraction system
 */

export type { MetadataExtractor, ExtractionContext, ExtractedMetadata } from './types.js';
export { ExtractorRegistry, createDefaultRegistry } from './registry.js';
export { YamlFrontmatterExtractor } from './yaml-frontmatter.js';
export { MetaYmlExtractor } from './meta-yml.js';
