import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration for the JavaScript plugin example.
 *
 * This example demonstrates:
 * - Frontmatter metadata extraction (id, title, description, custom fields)
 * - Region markers for code snippets (#region / #endregion)
 *
 * Plugin options (all optional):
 * - skipFrontmatter: true  - Disable frontmatter parsing
 * - skipRegions: true      - Disable region extraction
 */
const config: Config = {
  plugins: [createJavaScriptPlugin()],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;
