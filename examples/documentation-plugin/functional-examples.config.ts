import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import type { Config } from 'functional-examples';

/**
 * Configuration demonstrating the documentation plugin.
 *
 * The documentation plugin:
 * - Adds the `generate` CLI command
 * - Enables template-based doc generation
 * - Provides prose helpers (file(), region(), fencedBlock())
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createDocumentationPlugin({
      outputDir: 'generated-docs',
      format: 'markdown',
    }),
  ],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  region: {
    startTag: '#region',
    endTag: '#endregion',
  },
};

export default config;
