/**
 * Configuration system for functional-examples
 */

export { findConfigFile, loadConfig } from './loader.js';
export { mergeConfigs } from './merger.js';
export {
  resolveConfig,
  type ConfigValidationError,
  type ResolvedConfig,
} from './resolver.js';
export {
  ConfigSchema,
  ExtractorConfigSchema,
  ExtractorReferenceSchema,
  ScanConfigSchema,
} from './schema.js';
export type { ConfigSchemaType } from './schema.js';
export type { Config, ExtractorConfig, ScanConfig } from './types.js';
export { validateConfig } from './validator.js';
