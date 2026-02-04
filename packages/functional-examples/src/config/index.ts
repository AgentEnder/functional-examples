/**
 * Configuration system for functional-examples
 */

export type { Config, ExtractorConfig, ScanConfig, BaseConfig } from './types.js';
export { loadConfig, findConfigFile } from './loader.js';
export { validateConfig } from './validator.js';
export type { ValidationError } from './validator.js';
export { mergeConfigs } from './merger.js';
export { resolveConfig, type ResolvedConfig } from './resolver.js';
export {
  ConfigSchema,
  ExtractorConfigSchema,
  ExtractorReferenceSchema,
  ScanConfigSchema,
} from './schema.js';
export type { ConfigSchemaType } from './schema.js';
