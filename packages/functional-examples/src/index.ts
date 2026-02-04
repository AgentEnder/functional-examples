/**
 * functional-examples - A language-agnostic library for code examples
 *
 * @packageDocumentation
 */

// Core Types
export type {
  BaseMetadata,
  Example,
  ExampleFile,
  Extractor,
  ExtractorFactory,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
} from './types/index.js';

// Plugin system types
export type {
  Plugin,
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
} from './types/index.js';

// Scanner
export { scanExamples } from './scanner/index.js';
export type {
  FileConflict,
  PathMapping,
  ScanOptions,
  ScanResult,
} from './scanner/index.js';

// Regions
export type { RegionInfo, RegionMap, RegionOptions } from './regions/index.js';
export {
  parseRegions,
  extractRegion,
  stripRegionMarkers,
  listRegions,
  LANGUAGE_CONFIGS,
} from './regions/index.js';

// File helpers
export { readExampleFile, readExampleFiles } from './files/index.js';

// Configuration
export type {
  Config,
  ExtractorConfig,
  ExtractorConfigOrFunction,
  ExtractorReference,
  ScanConfig,
} from './config/types.js';
export type { ResolvedConfig } from './config/resolver.js';
export type { ValidationError } from './config/validator.js';
export { findConfigFile, loadConfig } from './config/loader.js';
export { mergeConfigs } from './config/merger.js';
export { resolveConfig } from './config/resolver.js';
export { validateConfig } from './config/validator.js';

// Plugin system
export { PluginRegistry, runParsePipeline, createInitialContext } from './plugins/index.js';
