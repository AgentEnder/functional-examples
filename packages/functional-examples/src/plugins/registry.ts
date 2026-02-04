import type {
  Plugin,
  Extractor,
  FileContentsParser,
  ValidationResult,
} from '../types/index.js';

/**
 * Wrapper for a plugin's validator function with plugin name context.
 */
export interface PluginValidator<T = unknown> {
  pluginName: string;
  validate: (value: T) => ValidationResult;
}

/**
 * Schema entry from a plugin with plugin name context.
 */
export interface PluginSchemaEntry {
  pluginName: string;
  options?: string;
  metadata?: string;
}

/**
 * Registry for plugins with extension-based lookup.
 */
export class PluginRegistry {
  private plugins: Plugin[] = [];
  private extensionMap: Map<string, Plugin[]> = new Map();

  /**
   * Register a plugin.
   * @throws If plugin with same name already registered
   */
  register(plugin: Plugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }

    this.plugins.push(plugin);

    // Index by extensions
    if (plugin.extensions) {
      for (const ext of plugin.extensions) {
        const existing = this.extensionMap.get(ext) ?? [];
        existing.push(plugin);
        this.extensionMap.set(ext, existing);
      }
    }
  }

  /**
   * Get all registered plugins.
   */
  getPlugins(): readonly Plugin[] {
    return this.plugins;
  }

  /**
   * Get plugins registered for a file extension.
   */
  getPluginsForExtension(extension: string): Plugin[] {
    return this.extensionMap.get(extension) ?? [];
  }

  /**
   * Get all extractors from registered plugins.
   */
  getExtractors(): Extractor[] {
    return this.plugins
      .filter(
        (p): p is Plugin & { extractor: Extractor } => p.extractor !== undefined
      )
      .map((p) => p.extractor);
  }

  /**
   * Get parsers for files with given extension, in registration order.
   */
  getParsersForExtension(extension: string): FileContentsParser[] {
    return this.getPluginsForExtension(extension)
      .filter(
        (p): p is Plugin & { fileContentsParser: FileContentsParser } =>
          p.fileContentsParser !== undefined
      )
      .map((p) => p.fileContentsParser);
  }

  /**
   * Get all options validators from registered plugins.
   */
  getOptionsValidators(): PluginValidator<unknown>[] {
    return this.plugins
      .filter((p) => p.validators?.options !== undefined)
      .map((p) => ({
        pluginName: p.name,
        validate: p.validators!.options!,
      }));
  }

  /**
   * Get all metadata validators from registered plugins.
   */
  getMetadataValidators(): PluginValidator[] {
    return this.plugins
      .filter((p) => p.validators?.metadata !== undefined)
      .map((p) => ({
        pluginName: p.name,
        validate: p.validators!.metadata!,
      }));
  }

  /**
   * Get all schemas from registered plugins.
   */
  getSchemas(): PluginSchemaEntry[] {
    return this.plugins
      .filter((p) => p.schemas !== undefined)
      .map((p) => ({
        pluginName: p.name,
        options: p.schemas!.options,
        metadata: p.schemas!.metadata,
      }));
  }
}
