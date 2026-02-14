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
 * JSON Schema for metadata fields consumed by the yaml-manifest plugin.
 */
const METADATA_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    include: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Glob patterns for files to include in the example bundle',
    },
  },
});

/**
 * Create a YAML manifest plugin for functional-examples.
 *
 * This plugin scans for directories containing meta.yml files,
 * treating each as a multi-file example.
 *
 * Unlike language plugins, this has no extensions (not file-type specific)
 * and no fileContentsParsers (manifest is separate from content).
 */
export function createYamlManifestPlugin(
  options?: MetaYmlExtractorOptions
): Plugin {
  return {
    name: 'yaml-manifest',
    extractor: createMetaYmlExtractor(options),
    schemas: {
      metadata: METADATA_SCHEMA,
    },
    // No extensions - not file-type specific
    // No fileContentsParsers - manifest is separate from content
  };
}
