/**
 * Core type definitions for functional-examples
 */

import type { CLI } from 'cli-forge';
import type { Dirent } from 'node:fs';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * A single validation error.
 */
export interface ValidationError {
  /** JSON path to the invalid value (e.g., "metadata.tags[0]") */
  path: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** Validation errors (empty if success is true) */
  errors: ValidationError[];
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Base metadata that all examples should have.
 * Used for type constraints when users want stricter typing.
 */
export interface BaseMetadata {
  /** Unique identifier for the example */
  id: string;
  /** Human-readable title */
  title: string;
  /** Description of what the example demonstrates */
  description?: string;
}

/**
 * Augmentable registry for example metadata typing.
 *
 * Run `functional-examples generate` to create a declaration file that
 * augments this interface, providing type-safe metadata for your examples.
 *
 * @example Manual augmentation (or use `generate` command):
 * ```typescript
 * declare module '@functional-examples/devkit' {
 *   interface ExampleMetadataRegistry {
 *     metadata: {
 *       id: string;
 *       title: string;
 *       tags?: string[];
 *     };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExampleMetadataRegistry {}

/**
 * Resolved example metadata type.
 *
 * If `ExampleMetadataRegistry` has been augmented with a `metadata` property,
 * this resolves to that type. Otherwise, falls back to `Record<string, unknown>`.
 *
 * This allows the `generate` command to provide project-specific types that
 * automatically apply to all `Example` types without explicit generic parameters.
 */
export type ExampleMetadata = ExampleMetadataRegistry extends {
  metadata: infer T;
}
  ? T
  : Record<string, unknown>;

/**
 * Parsed code region from #region markers.
 */
export interface ParsedRegion {
  /** Region identifier from #region <id> */
  id: string;
  /** Content between region markers (markers stripped) */
  content: string;
  /** Line number where #region marker appears (1-based) */
  startLine: number;
  /** Line number where #endregion marker appears (1-based) */
  endLine: number;
}

/**
 * A file within an example, with optional processed content.
 */
export class ExampleFile {
  /** Absolute path to the file */
  readonly absolutePath: string;
  /** Path relative to example root */
  readonly relativePath: string;
  /** Raw file contents (may be lazy-loaded) */
  raw?: string;
  /** Parsed content with metadata/markers stripped */
  parsed?: string;
  /** Extracted code regions */
  hunks?: ParsedRegion[];

  constructor(data: {
    absolutePath: string;
    relativePath: string;
    raw?: string;
    parsed?: string;
    hunks?: ParsedRegion[];
  }) {
    this.absolutePath = data.absolutePath;
    this.relativePath = data.relativePath;
    this.raw = data.raw;
    this.parsed = data.parsed;
    this.hunks = data.hunks;
  }

  /** Find a region/hunk by ID. Returns undefined if not found. */
  region(id: string): ParsedRegion | undefined {
    return this.hunks?.find((h) => h.id === id);
  }
}

/**
 * A discovered example with metadata and files.
 * This is the base type returned by extractors.
 *
 * Metadata is typed via `ExampleMetadata` by default, which can be augmented
 * by running `functional-examples generate`. You can also pass an explicit
 * generic parameter for custom typing.
 */
export interface Example<TMetadata = ExampleMetadata> {
  /** Unique identifier for this example */
  id: string;
  /** Human-readable title */
  title: string;
  /** Optional description */
  description?: string;
  /** Absolute path to the example root (file or directory) */
  rootPath: string;
  /** All files belonging to this example */
  files: ExampleFile[];
  /** Additional metadata (loosely typed unless user provides schema) */
  metadata: TMetadata;
  /** Which extractor produced this example */
  extractorName: string;
}

/**
 * An example after processing by the scanner.
 * Includes computed fields like displayPath that are added during scanning.
 */
export class ScannedExample<TMetadata = ExampleMetadata>
  implements Example<TMetadata>
{
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly rootPath: string;
  readonly files: ExampleFile[];
  readonly metadata: TMetadata;
  readonly extractorName: string;
  /**
   * Path relative to the config/scan root, useful for display in errors
   * and snapshots (avoids machine-specific absolute paths).
   */
  readonly displayPath: string;

  constructor(data: Example<TMetadata> & { displayPath: string }) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.rootPath = data.rootPath;
    this.files = data.files;
    this.metadata = data.metadata;
    this.extractorName = data.extractorName;
    this.displayPath = data.displayPath;
  }

  /** Find a file by its path relative to the example root. */
  file(relativePath: string): ExampleFile {
    const val = this.files.find((f) => f.relativePath === relativePath);
    if (val) {
      return val;
    }
    throw new Error(
      `File with relative path "${relativePath}" not found in example "${this.id}"`
    );
  }
}

/**
 * Error encountered during extraction
 */
export interface ExtractorError {
  /** Path where error occurred */
  path: string;
  /** Error message */
  message: string;
  /** Original error if available */
  cause?: Error;
}

/**
 * Options passed to extractor during extraction
 */
export interface ExtractorOptions {
  /** Absolute path to the config root (for context/relative paths) */
  rootPath: string;
  /** Glob patterns to exclude (for internal filtering within directories) */
  exclude?: string[];
  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result from a candidate-based extractor
 */
export interface ExtractorResult<TMetadata = Record<string, unknown>> {
  /** All examples found by this extractor */
  examples: Example<TMetadata>[];
  /** Errors encountered during extraction */
  errors: ExtractorError[];
  /** Files claimed by this extractor (absolute paths, for conflict detection) */
  claimedFiles: Set<string>;
}

/**
 * Candidate-based extractor interface.
 * Called with pre-filtered candidates (files and/or directories).
 * Extractor decides which candidates it can handle.
 */
export interface Extractor<TMetadata = Record<string, unknown>> {
  /** Unique name for this extractor */
  readonly name: string;

  /**
   * Extract examples from the provided candidates.
   * Candidates are pre-filtered by include/exclude patterns.
   *
   * @param candidates - Dirent entries (files and/or directories) to consider
   * @param options - Extraction options including rootPath for context
   * @returns All examples found and files claimed
   */
  extract(
    candidates: Dirent[],
    options: ExtractorOptions
  ): Promise<ExtractorResult<TMetadata>>;
}

/**
 * Factory function to create an extractor with options
 */
export type ExtractorFactory<
  TOptions = Record<string, unknown>,
  TMetadata = Record<string, unknown>
> = (options?: TOptions) => Extractor<TMetadata>;

/**
 * Context passed through the FileContentsParser pipeline.
 * Each parser receives this, transforms it, and returns an updated version.
 */
export interface FileParseContext {
  /** Original file content, never modified */
  raw: string;
  /** Transformed content (frontmatter/markers stripped) */
  parsed: string;
  /** Extracted code regions (only explicit #region blocks) */
  hunks: ParsedRegion[];
  /** Metadata extracted by parsers */
  metadata: Record<string, unknown>;
  /** Absolute path to the file */
  filePath: string;
  /**
   * Resolved region config from ResolvedConfig.region.
   * Always populated by createInitialContext using defaults if not configured.
   */
  regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>;
}

/**
 * Parser that processes file contents in a pipeline.
 * Receives accumulated context, transforms it, returns updated context.
 */
export interface FileContentsParser {
  /** Unique parser name for debugging/logging */
  readonly name: string;

  /**
   * Process file content and return updated context.
   * @param context - Current accumulated parse context
   * @returns Updated context (should not mutate input)
   */
  parse(
    context: FileParseContext
  ): FileParseContext | Promise<FileParseContext>;
}

// ============================================================================
// Plugin Schema and Validation Types
// ============================================================================

/**
 * Schema definitions for a plugin (JSON Schema format).
 * Used for IDE autocomplete and documentation generation.
 */
export interface PluginSchemas {
  /**
   * JSON Schema for plugin options (passed to createPlugin()).
   * Used to generate config file schema for IDE autocomplete.
   */
  options?: string;

  /**
   * JSON Schema for metadata this plugin produces or expects.
   * Used for metadata.d.ts generation and documentation.
   */
  metadata?: string;
}

/**
 * Validator functions for a plugin.
 * Allows plugins to use any validation library (Zod, TypeBox, etc.)
 */
export interface PluginValidators<TMetadata = Record<string, unknown>> {
  /**
   * Validates plugin options before extraction begins.
   * Called during config resolution.
   * @param options - The options passed to the plugin factory
   */
  options?: (options: unknown) => ValidationResult;

  /**
   * Validates extracted metadata after all extractors complete.
   * Called for each example's metadata.
   * @param metadata - The metadata from an extracted example
   */
  metadata?: (metadata: TMetadata) => ValidationResult;
}

// ============================================================================
// Configuration Types (defined here to avoid circular dependencies)
// ============================================================================

/**
 * Configuration for region marker parsing.
 */
export interface RegionConfig {
  /** Token that opens a region. Default: 'region' */
  startTag?: string;
  /** Token that closes a region. Default: 'endregion' */
  endTag?: string;
  /**
   * Map of file extension to an array of regex pattern strings.
   * `{token}` is substituted with startTag or endTag at parse time.
   * Each pattern must contain exactly one capturing group `(\w+)` for the region ID.
   * Multiple patterns per extension support multiple comment styles (e.g. line + block).
   * User entries are merged over the built-in DEFAULT_REGION_EXTENSION_MAP (user wins).
   *
   * @example
   * { '.py': [/#\s*{token}\s+(\w+)/] }
   */
  fileExtensionMap?: Record<string, (string | RegExp)[]>;
}

/**
 * Scan configuration options.
 */
export interface ScanConfig {
  /** Include patterns (applied after extraction) */
  include?: string[];
  /** Exclude patterns (applied after extraction) */
  exclude?: string[];
  /** Base Path for scan. Differs from `root` in that it only impacts scanning. */
  root?: string;
}

/**
 * Path-to-extractor mapping for conflict resolution.
 */
export interface PathMapping {
  /** Glob pattern for paths */
  pattern: string;
  /** Extractor name that wins for matching paths */
  extractor: string;
}

/**
 * Error from config validation.
 */
export interface ConfigValidationError {
  /** JSON path to the invalid value */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Location code (e.g., Zod issue code) */
  location?: string;
  /** Suggested fix for the error */
  fix?: string;
}

/**
 * Wrapper for a plugin's validator function with plugin name context.
 */
export interface PluginValidatorEntry<T = unknown> {
  pluginName: string;
  validate: (value: T) => ValidationResult;
}

/**
 * Schema entry from a plugin with plugin name context.
 */
export interface PluginSchemaEntry {
  pluginName: string;
  /** Package name this plugin was loaded from (set for string/tuple refs) */
  packageName?: string;
  options?: string;
  metadata?: string;
}

/**
 * Plugin registry interface for accessing validators/schemas.
 * Full implementation is in plugins/registry.ts.
 */
export interface PluginRegistryInterface {
  /** Register a plugin */
  register(plugin: Plugin): void;
  /** Get all registered plugins */
  getPlugins(): readonly Plugin[];
  /** Get plugins for a file extension */
  getPluginsForExtension(extension: string): Plugin[];
  /** Get all extractors from plugins */
  getExtractors(): Extractor[];
  /** Get parsers for a file extension */
  getParsersForExtension(extension: string): FileContentsParser[];
  /** Get all options validators */
  getOptionsValidators(): PluginValidatorEntry<unknown>[];
  /** Get all metadata validators */
  getMetadataValidators(): PluginValidatorEntry[];
  /** Get all schemas from plugins */
  getSchemas(): PluginSchemaEntry[];
}

// ============================================================================
// Extractor Configuration Types
// ============================================================================

/**
 * Reference to an extractor package (for config files)
 */
export interface ExtractorConfig {
  /** Package name */
  name: string;
  /** Module specifier (package name or path) */
  module: string;
  /** Options to pass to the extractor factory */
  options?: Record<string, unknown>;
}

/**
 * Extractor can be specified as string (package name) or full config
 */
export type ExtractorReference = string | ExtractorConfig;

/**
 * An extractor can be a reference (to load) or an instance
 */
export type ExtractorConfigOrFunction<TMetadata = Record<string, unknown>> =
  | ExtractorReference
  | Extractor<TMetadata>;

/**
 * JSON Schema object for metadata validation.
 * Subset of JSON Schema spec used for config files.
 */
export interface JSONSchemaObject {
  type?: string;
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: unknown[];
  const?: unknown;
  description?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the generate command output.
 */
export interface GenerateConfig {
  /** Output directory for generated files (default: .functional-examples) */
  outputDir?: string;
}

/**
 * A reference to a plugin by package name, optionally with options.
 *
 * In JSON configs, plugins can be specified as:
 * - A string: `"@functional-examples/yaml-manifest"`
 * - A tuple: `["@functional-examples/javascript", { "regionTag": "#_" }]`
 */
export type PluginReference = string | [string, Record<string, unknown>];

/**
 * Augmentable registry for typed plugin references.
 *
 * Run `functional-examples generate` to create a declaration file that
 * augments this interface, providing type-safe plugin references with
 * autocomplete for plugin options.
 *
 * @example Manual augmentation (or use `generate` command):
 * ```typescript
 * declare module '@functional-examples/devkit' {
 *   interface PluginOptionsRegistry {
 *     plugins:
 *       | '@functional-examples/yaml-manifest'
 *       | '@functional-examples/javascript'
 *       | ['@functional-examples/javascript', { skipFrontmatter?: boolean }]
 *       | import('@functional-examples/devkit').PluginReference;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PluginOptionsRegistry {}

/**
 * Resolved plugin reference type.
 *
 * If `PluginOptionsRegistry` has been augmented with a `plugins` property
 * (via `functional-examples generate`), this resolves to that typed union.
 * Otherwise, falls back to the generic `PluginReference`.
 */
export type TypedPluginReference = PluginOptionsRegistry extends {
  plugins: infer T;
}
  ? T
  : PluginReference;

export interface Config {
  /** Plugins to use for scanning and parsing (recommended) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins?: (Plugin<any> | TypedPluginReference)[];
  /** Scan options */
  scan?: ScanConfig;
  /** Path mappings for conflict resolution */
  pathMappings?: PathMapping[];

  /**
   * JSON Schema defining the expected metadata structure for examples.
   * This is the user's base metadata contract - all examples must conform to it.
   * Overrides plugin metadata schemas on conflict.
   *
   * @example
   * ```typescript
   * metadata: {
   *   type: 'object',
   *   properties: {
   *     id: { type: 'string' },
   *     title: { type: 'string' },
   *     category: { type: 'string', enum: ['tutorial', 'recipe', 'reference'] },
   *   },
   *   required: ['id', 'title', 'category'],
   * }
   * ```
   */
  metadata?: JSONSchemaObject;

  /** Configuration for schema/type generation */
  generate?: GenerateConfig;

  /** Region marker configuration */
  region?: RegionConfig;

  /**
   * Root path used for scanning + more
   */
  root?: string;
}

/**
 * Full configuration (alias for BaseConfig)
 */
export type ConfigWithRoot = Config & { root: string };

// ============================================================================
// Resolved Configuration Types
// ============================================================================

/**
 * Resolved configuration with actual extractor instances.
 * This is the runtime-ready configuration after all plugins are loaded.
 */
export interface ResolvedConfig<TMetadata = ExampleMetadata>
  extends ConfigWithRoot {
  /** Resolved extractor instances */
  extractors: Extractor<TMetadata>[];
  /** Resolved plugins */
  plugins: Plugin<TMetadata>[];
  /** Plugin registry for accessing validators/schemas */
  registry: PluginRegistryInterface;
  /** Path mappings for conflict resolution */
  pathMappings: PathMapping[];
  /** Scan configuration with defaults applied */
  scan: Required<ScanConfig>;
  /** Config validation errors (options validation failures) */
  validationErrors: ConfigValidationError[];
  /**
   * Fully resolved region config with defaults applied and extension maps merged.
   * Always present — defaults to startTag:'region', endTag:'endregion'.
   */
  region: Required<RegionConfig>;
  /** Root Path of Config File */
  root: string;
}

// ============================================================================
// Plugin Commands Types
// ============================================================================

/**
 * Plugin commands can be a static array or a function that receives
 * the resolved config and returns commands (sync or async).
 */
export type PluginCommands<TMetadata = ExampleMetadata> =
  | CLI[]
  | ((config: ResolvedConfig<TMetadata>) => CLI[] | Promise<CLI[]>);

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Plugin containing optional extractors, parsers, schemas, and validators.
 * Auto-registers for declared file extensions.
 */
export interface Plugin<TMetadata = ExampleMetadata> {
  /** Unique plugin name */
  readonly name: string;

  /** File extensions this plugin handles (e.g., ['.ts', '.tsx', '.js', '.jsx']) */
  readonly extensions?: string[];

  /** Extractor that finds examples in a directory tree */
  readonly extractor?: Extractor<TMetadata>;

  /** Parsers that process file contents (run in pipeline order) */
  readonly fileContentsParsers?: FileContentsParser[];

  /**
   * JSON Schema definitions for IDE tooling.
   * @see PluginSchemas
   */
  readonly schemas?: PluginSchemas;

  /**
   * Runtime validators for options and metadata.
   * @see PluginValidators
   */
  readonly validators?: PluginValidators<TMetadata>;

  /**
   * CLI commands provided by this plugin.
   * Can be static commands or a function that receives the resolved config.
   * @see PluginCommands
   */
  readonly commands?: PluginCommands<TMetadata>;

  /**
   * Options passed to the plugin factory (for validation introspection).
   * Plugin factories should set this to enable options validation.
   * @internal
   */
  readonly _options?: unknown;

  /**
   * Package name this plugin was loaded from (e.g., "@functional-examples/javascript").
   * Set automatically during resolution when a string/tuple reference is used.
   * Used by the `generate` command to emit typed plugin reference types.
   * @internal
   */
  readonly _packageName?: string;
}
