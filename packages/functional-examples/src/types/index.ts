/**
 * Core type definitions for functional-examples
 *
 * Types are defined in @functional-examples/devkit and re-exported here
 * for backwards compatibility.
 */

// Re-export classes (value + type exports)
export { ExampleFile, ScannedExample } from '@functional-examples/devkit';

// Re-export all plugin-facing types from devkit
export type {
  // Validation
  ValidationError,
  ValidationResult,

  // Metadata
  BaseMetadata,
  ExampleMetadata,
  ExampleMetadataRegistry,

  // Examples
  ParsedRegion,
  Example,

  // Extractors
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
  Extractor,
  ExtractorFactory,

  // File parsing
  FileParseContext,
  FileContentsParser,

  // Plugin
  Plugin,
  PluginReference,
  PluginCommands,
  PluginSchemas,
  PluginValidators,
  PluginRegistryInterface,
  PluginValidatorEntry,
  PluginSchemaEntry,

  // Configuration
  Config,
  ConfigWithRoot,
  ScanConfig,
  PathMapping,
  ConfigValidationError,
  ResolvedConfig,
  JSONSchemaObject,
  GenerateConfig,
  ExtractorConfig,
  ExtractorReference,
  ExtractorConfigOrFunction,
} from '@functional-examples/devkit';

// Re-export utility types
export type { TypeGuard } from './guards.js';

// Re-export utility classes (internal to core, NOT in devkit)
export { DefaultMap } from './default-map.js';
export {
  asSettled,
  AsyncExtendedIterable,
  asyncIter,
  ExtendedIterable,
  iter,
} from './extended-iterable.js';
