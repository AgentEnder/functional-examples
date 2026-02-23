/**
 * functional-examples - A language-agnostic library for code examples
 *
 * @packageDocumentation
 */

// Core Types
export { ExampleFile, ScannedExample } from './types/index.js';
export type {
  BaseMetadata,
  Example,
  ExampleMetadata,
  ExampleMetadataRegistry,
  Extractor,
  ExtractorFactory,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
} from './types/index.js';

// Plugin system types
export type {
  Plugin,
  PluginCommands,
  FileContentsParser,
  FileParseContext,
  ParsedRegion,
  PluginSchemas,
  PluginValidators,
} from './types/index.js';

// Validation types
export type {
  ValidationResult,
  ValidationError,
} from './types/index.js';

// Scanner
export { scanExamples } from './scanner/index.js';
export { scan } from './scanner/index.js';
export type { ScanOptions } from './scanner/index.js';
export type {
  FileConflict,
  PathMapping,
  ScanResult,
} from './scanner/index.js';

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
export type {
  ConfigValidationError,
  ResolvedConfig,
} from './types/index.js';
export { findConfigFile, loadConfig } from './config/loader.js';
export { mergeConfigs } from './config/merger.js';
export { resolveConfig } from './config/resolver.js';
export { validateConfig } from './config/validator.js';

// Plugin system
export {
  PluginRegistry,
  runParsePipeline,
  createInitialContext,
} from './plugins/index.js';

// Plugin validation
export {
  validatePluginOptions,
  validateExampleMetadata,
} from './plugins/validation.js';
export type {
  PluginValidator,
  PluginSchemaEntry,
} from './plugins/registry.js';
export type {
  PluginOptionsValidationContext,
  MetadataValidationContext,
  OptionsValidationResult,
  MetadataValidationResult,
  OptionsValidationError,
  MetadataValidationError,
} from './plugins/validation.js';

// Schema utilities
export {
  mergeConfigSchema,
  mergeMetadataSchemas,
  generateTypes,
} from './schema/index.js';
export type {
  JSONSchema,
  MergeConfigSchemaOptions,
  MergeMetadataSchemasOptions,
  GenerateTypesOptions,
} from './schema/index.js';

// Config types for metadata schema
export type {
  JSONSchemaObject,
  GenerateConfig,
} from './config/types.js';
