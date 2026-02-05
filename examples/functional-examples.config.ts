import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog all the showcase examples across the different projects.
 */
const config: Config = {
  plugins: [createJavaScriptPlugin(), createYamlManifestPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  // Resolve conflicts: JavaScript plugin handles src/ files,
  // YAML manifest handles tutorials/ and examples/ directories
  pathMappings: [
    { pattern: '**/src/**', extractor: 'javascript-extractor' },
    { pattern: '**/tutorials/**', extractor: 'meta-yml' },
    { pattern: '**/examples/**', extractor: 'meta-yml' },
  ],
};

export default config;
