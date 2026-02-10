/**
 * Init command - create a configuration file
 */

import { cli } from 'cli-forge';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findConfigFile } from '../../config/loader.js';

const TS_CONFIG_TEMPLATE = `import type { Config } from 'functional-examples';

const config: Config = {
  // Extractors to use (auto-detected if not specified)
  // extractors: [
  //   '@functional-examples/extractor-frontmatter',
  //   '@functional-examples/yaml-manifest',
  // ],

  // Scan configuration
  scan: {
    // Include patterns (applied after extraction)
    // include: ['*'],
    // Exclude patterns
    // exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },

  // Path mappings for conflict resolution
  // pathMappings: [
  //   { pattern: 'legacy/**', extractor: 'frontmatter' },
  // ],
};

export default config;
`;

const JSON_CONFIG_TEMPLATE = `{
  "$schema": "./.functional-examples/schema.json",
  "scan": {
    // "include": ["**/*"],
    // "exclude": ["**/node_modules/**", "**/dist/**", "**/.git/**"]
  }
}
`;

export const initCommand = cli('init', {
  description: 'Create a new configuration file',
  builder: (cmd) =>
    cmd
      .option('format', {
        type: 'string',
        alias: ['f'],
        description: 'Output format',
        choices: ['ts', 'json'] as const,
        default: 'ts' as const,
      })
      .option('output', {
        type: 'string',
        alias: ['o'],
        description: 'Output file path (auto-generated if not specified)',
      })
      .option('force', {
        type: 'boolean',
        description: 'Overwrite existing config file',
        default: false,
      }),
  handler: async (options) => {
    const outputPath = options.output ?? getDefaultOutputPath(options.format);
    const absolutePath = path.resolve(outputPath);

    if (!options.force) {
      const existingConfig = await findConfigFile();
      if (existingConfig) {
        console.log(`Configuration file already exists: ${existingConfig}`);
        console.log('Use --force to overwrite.');
        process.exit(1);
      }

      if (existsSync(absolutePath)) {
        console.log(`File already exists: ${absolutePath}`);
        console.log('Use --force to overwrite.');
        process.exit(1);
      }
    }

    const content =
      options.format === 'ts' ? TS_CONFIG_TEMPLATE : JSON_CONFIG_TEMPLATE;

    await writeFile(absolutePath, content, 'utf-8');

    console.log(`Created configuration file: ${outputPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Install extractors:');
    console.log('     pnpm add @functional-examples/extractor-frontmatter');
    console.log('     pnpm add @functional-examples/yaml-manifest');
    console.log('');
    console.log('  2. Run the scanner:');
    console.log('     functional-examples scan ./examples');
  },
});

function getDefaultOutputPath(format: 'ts' | 'json'): string {
  const ext = format === 'ts' ? '.ts' : '.json';
  return `functional-examples.config${ext}`;
}
