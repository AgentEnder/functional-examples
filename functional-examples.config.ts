import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type { Config } from 'functional-examples';

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog each showcase project as a single example.
 *
 * - yaml-manifest handles file discovery via meta.yml + include globs
 * - javascript plugin contributes extraction only (no parsers needed)
 * - region config handles all marker extraction generically:
 *   - startTag '#_region' matches `// #_region name`, `# #_region name`, etc.
 *   - fileExtensionMap extends defaults with YAML, Bash, and JSON comment styles
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin({
      skipExtraction: true,
    }),
    createYamlManifestPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
  scan: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: 'examples',
    include: ['*'],
  },
  region: {
    // '#_region' prefix mirrors VS Code's #region syntax, making markers
    // double as recognised code folding hints in editors.
    startTag: '#_region',
    endTag: '#_endregion',
    fileExtensionMap: {
      // Hash-comment files not in the default map
      '.bash': [/#\s*{token}\s+(\w+)/],
      '.yml':  [/#\s*{token}\s+(\w+)/],
      '.yaml': [/#\s*{token}\s+(\w+)/],
      // JSON: `"#_region name": true` key markers (valid JSON, ignored at runtime)
      '.json': [/"{token}\s+(\w+)":\s*.+/],
    },
  },
};

export default config;
