import type { Config } from 'functional-examples';
import { createIniPlugin } from './src/ini-plugin.js';

/**
 * Configuration demonstrating a custom INI plugin.
 *
 * The INI plugin provides:
 * - An extractor that discovers `meta.ini` files
 * - A parser that strips INI comments from content
 */
const config = {
  plugins: [createIniPlugin()],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**'],
  },
} satisfies Config;

export default config;
