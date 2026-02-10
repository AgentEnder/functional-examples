import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import type { Config } from 'functional-examples';

const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
  scan: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: 'tests',
  },
};

export default config;
