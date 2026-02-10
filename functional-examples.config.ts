import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import type { Config } from 'functional-examples';

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog each showcase project as a single example. Each project
 * has its own package.json with functional-examples metadata.
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
  scan: {
    // Root auto-infers to 'examples/' directory, so include defaults to '*'
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: 'examples',
  },
};

export default config;
