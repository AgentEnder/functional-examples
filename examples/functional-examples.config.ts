import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog each showcase project as a single example. Each project
 * has its own meta.yml describing what it demonstrates.
 */
const config: Config = {
  plugins: [createYamlManifestPlugin()],
  scan: {
    // Match only the top-level project directories (not nested examples)
    include: [
      '**/javascript-plugin',
      '**/yaml-manifest',
      '**/metadata-validation',
      '**/mixed-plugins',
      '**/custom-extractor',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;
