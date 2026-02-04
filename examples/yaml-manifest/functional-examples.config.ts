import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Configuration for the YAML manifest example.
 *
 * This example demonstrates directory-based example organization where
 * each example is a folder containing:
 * - meta.yml (or meta.yaml) with metadata
 * - Source files for the example
 *
 * Benefits of this approach:
 * - Multi-file examples are natural (just add more files)
 * - Metadata is separate from code (no frontmatter comments)
 * - Works with any file type (not just JS/TS)
 */
const config: Config = {
  plugins: [createYamlManifestPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;
