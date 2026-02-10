/**
 * @functional-examples/yaml-manifest
 *
 * YAML manifest plugin for multi-file examples.
 *
 * @example
 * ```typescript
 * import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
 * import { scanExamples } from 'functional-examples';
 *
 * const result = await scanExamples({
 *   root: './examples',
 *   plugins: [createYamlManifestPlugin()],
 * });
 * ```
 */

import type { Plugin } from '@functional-examples/devkit';
import {
  createMetaYmlExtractor,
  type MetaYmlExtractorOptions,
} from './extractor.js';

// Re-export for backward compatibility
export {
  createMetaYmlExtractor,
  type MetaYmlExtractorOptions,
} from './extractor.js';

// New name alias
export const createYamlManifestExtractor = createMetaYmlExtractor;
export type YamlManifestExtractorOptions = MetaYmlExtractorOptions;

/**
 * Create a YAML manifest plugin for functional-examples.
 *
 * This plugin scans for directories containing meta.yml files,
 * treating each as a multi-file example.
 *
 * Unlike language plugins, this has no extensions (not file-type specific)
 * and no fileContentsParser (manifest is separate from content).
 */
export function createYamlManifestPlugin(
  options?: MetaYmlExtractorOptions
): Plugin {
  return {
    name: 'yaml-manifest',
    extractor: createMetaYmlExtractor(options),
    // No extensions - not file-type specific
    // No fileContentsParser - manifest is separate from content
  };
}
