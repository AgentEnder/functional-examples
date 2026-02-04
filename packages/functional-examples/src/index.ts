/**
 * functional-examples - A language-agnostic library for code examples
 *
 * @packageDocumentation
 */

// Types
export type {
  Example,
  ExampleFile,
  BaseMetadata,
  ScanOptions,
  ScanResult,
} from './types/index.js';

// Extractors
export type { MetadataExtractor, ExtractionContext } from './extractors/index.js';
export {
  ExtractorRegistry,
  createDefaultRegistry,
  YamlFrontmatterExtractor,
  MetaYmlExtractor,
} from './extractors/index.js';

// Regions
export type { RegionInfo, RegionMap, RegionOptions } from './regions/index.js';
export {
  parseRegions,
  extractRegion,
  stripRegionMarkers,
  listRegions,
  LANGUAGE_CONFIGS,
} from './regions/index.js';

// Scanner
export { ExampleScanner, scanExamples } from './scanner/index.js';

// File helpers
export { readExampleFile, readExampleFiles } from './files/index.js';
