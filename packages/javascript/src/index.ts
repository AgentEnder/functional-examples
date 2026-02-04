export const JAVASCRIPT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
] as const;

export { createJavaScriptParser } from './parser.js';
export { createFrontmatterParser } from './frontmatter.js';
