// Re-export all types
export type { TypeGuard } from './types/guards.js';
export type {
  BaseMetadata,
  Config,
  ConfigValidationError,
  ConfigWithRoot,
  Example,
  ExampleFile,
  ExampleMetadata,
  ExampleMetadataRegistry,
  Extractor,
  ExtractorConfig,
  ExtractorConfigOrFunction,
  ExtractorError,
  ExtractorFactory,
  ExtractorOptions,
  ExtractorReference,
  ExtractorResult,
  FileContentsParser,
  FileParseContext,
  GenerateConfig,
  JSONSchemaObject,
  ParsedRegion,
  PathMapping,
  Plugin,
  PluginReference,
  PluginCommands,
  PluginRegistryInterface,
  PluginSchemaEntry,
  PluginSchemas,
  PluginValidatorEntry,
  PluginValidators,
  ResolvedConfig,
  ScanConfig,
  ScannedExample,
  ValidationError,
  ValidationResult,
} from './types/index.js';

export {
  createMatcher,
  glob,
  isMatch,
  type GlobOptions,
} from './glob/index.js';

export { JsonParseError, parseJson, tryParseJson } from './json/index.js';

export { parseYaml, tryParseYaml, YamlParseError } from './yaml/index.js';
