/**
 * Configuration resolver - converts config references to actual plugins/extractors
 */

import { resolve } from 'node:path';
import { PluginRegistry } from '../plugins/registry.js';
import { validatePluginOptions } from '../plugins/validation.js';
import { getDefaultIncludePattern } from '../scanner/candidates.js';
import type {
  ConfigValidationError,
  ExampleMetadata,
  Extractor,
  Plugin,
  PluginReference,
  ResolvedConfig,
  ScanConfig,
} from '../types/index.js';
import type { ConfigWithRoot } from './types.js';

// Re-export for backward compatibility
export type { ConfigValidationError, ResolvedConfig } from '../types/index.js';

import type { RegionConfig } from '@functional-examples/devkit';
import { DEFAULT_REGION_EXTENSION_MAP } from '../regions/defaults.js';

/**
 * Known plugin packages that can be auto-detected when no plugins are specified.
 * Each entry maps to a package that exports a `createXxxPlugin()` factory function.
 */
const KNOWN_PLUGINS = [
  '@functional-examples/javascript',
  '@functional-examples/yaml-manifest',
] as const;

/**
 * Default scan configuration
 */
const DEFAULT_SCAN: Omit<Required<ScanConfig>, 'include'> = {
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  root: '.',
};

/**
 * Default region tag configuration
 */
const DEFAULT_REGION_TAG = {
  startTag: '#region',
  endTag: '#endregion',
} as const;

/**
 * Resolve a configuration to actual plugin and extractor instances.
 *
 * Plugin resolution follows this priority:
 * 1. If `config.plugins` contains Plugin instances (from TS configs), use directly
 * 2. If `config.plugins` contains string/tuple references (from JSON configs),
 *    resolve them by dynamically importing the package and calling its factory
 * 3. If no plugins specified at all, auto-detect installed plugin packages
 *
 * @example
 * ```typescript
 * import { resolveConfig } from 'functional-examples';
 *
 * // Auto-detect plugins from installed packages
 * const config = await resolveConfig({ root: './examples' });
 *
 * // Use with scanExamples
 * const result = await scanExamples(config);
 * ```
 */
export async function resolveConfig<TMetadata = ExampleMetadata>(
  config: ConfigWithRoot
): Promise<ResolvedConfig<TMetadata>> {
  const validationErrors: ConfigValidationError[] = [];

  // Step 1: Resolve plugins (from config entries or auto-detection)
  const registry = new PluginRegistry();
  let plugins: Plugin<TMetadata>[];

  const configPlugins = config.plugins ?? [];

  if (configPlugins.length > 0) {
    // Resolve any string/tuple references to actual Plugin instances
    plugins = await resolvePluginEntries<TMetadata>(configPlugins);
  } else {
    // Auto-detect installed plugin packages
    plugins = await autoDetectPlugins<TMetadata>();
  }

  // Register all resolved plugins in the registry
  for (const plugin of plugins) {
    registry.register(plugin as Plugin);
  }

  // Step 2: Run options validation for plugins that have validators
  const optionsValidators = registry.getOptionsValidators();
  if (optionsValidators.length > 0) {
    const pluginOptions = new Map<string, unknown>();
    for (const plugin of plugins) {
      if ('_options' in plugin && plugin._options !== undefined) {
        pluginOptions.set(plugin.name, plugin._options);
      }
    }

    const optionsResult = validatePluginOptions({
      validators: optionsValidators,
      pluginOptions,
    });

    if (!optionsResult.success) {
      for (const error of optionsResult.errors) {
        validationErrors.push({
          path: `plugins.${error.pluginName}.${error.path}`,
          message: error.message,
        });
      }
    }
  }

  // Step 3: Extract extractors from the registry
  const extractors = registry.getExtractors() as Extractor<TMetadata>[];

  // Resolve scan root to an absolute path (defaults to config root)
  const scanRoot = config.scan?.root
    ? resolve(config.root, config.scan.root)
    : config.root;

  // Determine effective include pattern (smart default detection)
  const effectiveInclude = config.scan?.include?.length
    ? config.scan.include
    : await getDefaultIncludePattern(scanRoot);

  const resolvedRegion: Required<RegionConfig> = {
    startTag: config.region?.startTag ?? DEFAULT_REGION_TAG.startTag,
    endTag: config.region?.endTag ?? DEFAULT_REGION_TAG.endTag,
    fileExtensionMap: {
      ...DEFAULT_REGION_EXTENSION_MAP,
      ...(config.region?.fileExtensionMap ?? {}),
    },
  };

  return {
    ...config,
    region: resolvedRegion,
    extractors,
    plugins,
    registry,
    pathMappings: config.pathMappings ?? [],
    scan: {
      ...DEFAULT_SCAN,
      ...config.scan,
      root: scanRoot,
      include: effectiveInclude,
    },
    validationErrors,
  };
}

/**
 * Resolve an array of plugin entries (instances, strings, or tuples)
 * into actual Plugin instances.
 */
async function resolvePluginEntries<TMetadata = Record<string, unknown>>(
  entries: (Plugin<TMetadata> | PluginReference)[]
): Promise<Plugin<TMetadata>[]> {
  const plugins: Plugin<TMetadata>[] = [];

  for (const entry of entries) {
    if (isPluginInstance(entry)) {
      // Already a Plugin instance (from TS config)
      plugins.push(entry as Plugin<TMetadata>);
    } else if (typeof entry === 'string') {
      // String reference: "@functional-examples/yaml-manifest"
      const plugin = await loadPluginFromPackage(entry);
      if (plugin) {
        plugins.push({ ...plugin, _packageName: entry } as Plugin<TMetadata>);
      }
    } else if (Array.isArray(entry) && entry.length >= 1) {
      // Tuple reference: ["@functional-examples/javascript", { regionTag: "#_" }]
      const [packageName, options] = entry as [
        string,
        Record<string, unknown>?
      ];
      const plugin = await loadPluginFromPackage(packageName, options);
      if (plugin) {
        plugins.push({
          ...plugin,
          _packageName: packageName,
        } as Plugin<TMetadata>);
      }
    }
  }

  return plugins;
}

/**
 * Auto-detect installed plugin packages.
 * Tries to import each known plugin package and call its factory function.
 */
async function autoDetectPlugins<
  TMetadata = Record<string, unknown>
>(): Promise<Plugin<TMetadata>[]> {
  const plugins: Plugin<TMetadata>[] = [];

  for (const packageName of KNOWN_PLUGINS) {
    try {
      const plugin = await loadPluginFromPackage(packageName);
      if (plugin) {
        plugins.push({
          ...plugin,
          _packageName: packageName,
        } as Plugin<TMetadata>);
      }
    } catch {
      // Package not installed, skip silently
    }
  }

  return plugins;
}

/**
 * Load a plugin from a package by dynamically importing it and calling
 * its factory function. Looks for common export patterns:
 *
 * - `createXxxPlugin(options)` — preferred factory pattern
 * - `module.default` — default export as Plugin instance
 *
 * Falls back to loading just an extractor if no plugin factory is found,
 * wrapping it in a minimal Plugin for backward compatibility.
 */
async function loadPluginFromPackage(
  packageName: string,
  options?: Record<string, unknown>
): Promise<Plugin | null> {
  try {
    const module = await import(packageName);

    // Look for createXxxPlugin factory functions first
    const pluginFactory = findPluginFactory(module);
    if (pluginFactory) {
      return pluginFactory(options);
    }

    // Check if default export is already a Plugin instance
    if (isPluginInstance(module.default)) {
      return module.default as Plugin;
    }

    // Fall back to extractor-only patterns (backward compatibility)
    const extractorFactory = findExtractorFactory(module);
    if (extractorFactory) {
      const extractor = extractorFactory(options);
      return {
        name: extractor.name,
        extractor,
      };
    }

    if (isExtractorInstance(module.default)) {
      const extractor = module.default as Extractor;
      return {
        name: extractor.name,
        extractor,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Find a plugin factory function in a module's exports.
 * Matches the pattern `createXxxPlugin`.
 */
function findPluginFactory(
  module: Record<string, unknown>
): ((options?: Record<string, unknown>) => Plugin) | null {
  // Check named exports for createXxxPlugin pattern
  for (const key of Object.keys(module)) {
    if (key.endsWith('Plugin') && key.startsWith('create')) {
      const value = module[key];
      if (typeof value === 'function') {
        return value as (options?: Record<string, unknown>) => Plugin;
      }
    }
  }

  // Check default export
  if (module.default && typeof module.default === 'object') {
    const defaultObj = module.default as Record<string, unknown>;
    for (const key of Object.keys(defaultObj)) {
      if (key.endsWith('Plugin') && key.startsWith('create')) {
        const value = defaultObj[key];
        if (typeof value === 'function') {
          return value as (options?: Record<string, unknown>) => Plugin;
        }
      }
    }
  }

  return null;
}

/**
 * Find an extractor factory function in a module's exports.
 * For backward compatibility with packages that only export extractors.
 */
function findExtractorFactory(
  module: Record<string, unknown>
): ((options?: Record<string, unknown>) => Extractor) | null {
  for (const key of Object.keys(module)) {
    if (key.startsWith('create') && key.endsWith('Extractor')) {
      const value = module[key];
      if (typeof value === 'function') {
        return value as (options?: Record<string, unknown>) => Extractor;
      }
    }
  }

  return null;
}

/**
 * Check if a value is a Plugin instance (has name: string).
 */
function isPluginInstance<TMetadata>(
  value: unknown
): value is Plugin<TMetadata> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as Plugin).name === 'string' &&
    !Array.isArray(value)
  );
}

/**
 * Check if value is an Extractor instance
 */
function isExtractorInstance<TMetadata>(
  value: unknown
): value is Extractor<TMetadata> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'extract' in value &&
    typeof (value as Extractor).name === 'string' &&
    typeof (value as Extractor).extract === 'function'
  );
}
