import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Configuration demonstrating multiple plugins working together.
 *
 * When both plugins are active, they may both try to claim the same files.
 * Use pathMappings to specify which plugin should handle specific paths.
 *
 * In this example:
 * - src/** files use the JavaScript plugin (frontmatter)
 * - tutorials/** directories use the YAML manifest plugin
 */
const config: Config = {
  plugins: [createJavaScriptPlugin(), createYamlManifestPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**'],
  },
  // Resolve conflicts: specify which extractor wins for each path pattern
  pathMappings: [
    {
      pattern: 'src/**',
      extractor: 'javascript-extractor',
    },
    {
      pattern: 'tutorials/**',
      extractor: 'meta-yml',
    },
  ],
};

export default config;
