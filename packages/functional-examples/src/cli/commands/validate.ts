/**
 * Validate command - validate configuration file
 */

import { cli } from 'cli-forge';
import { findConfigFile, loadConfig } from '../../config/loader.js';
import { validateConfig } from '../../config/validator.js';
import { resolveConfig } from '../../config/resolver.js';

export const validateCommand = cli('validate', {
  description: 'Validate the configuration file',
  builder: (cmd) =>
    cmd
      .option('config', {
        type: 'string',
        alias: ['c'],
        description: 'Path to config file (auto-detected if not specified)',
      })
      .option('strict', {
        type: 'boolean',
        description: 'Treat warnings as errors',
        default: false,
      }),
  handler: async (options) => {
    const configPath = options.config ?? (await findConfigFile());

    if (!configPath) {
      console.log('No configuration file found.');
      console.log('Run "functional-examples init" to create one.');
      process.exit(0);
    }

    console.log(`Validating: ${configPath}`);
    console.log('');

    let config;
    try {
      config = await loadConfig(configPath);
    } catch (error) {
      console.error('Failed to load config:');
      console.error(`  ${(error as Error).message}`);
      process.exit(1);
    }

    const errors = validateConfig(config);

    if (errors.length > 0) {
      console.error('Configuration errors:');
      for (const error of errors) {
        console.error(`  - ${error.path}: ${error.message}`);
      }
      process.exit(1);
    }

    try {
      const resolved = await resolveConfig(config);

      console.log('Configuration is valid!');
      console.log('');
      console.log(`Extractors: ${resolved.extractors.length}`);
      for (const extractor of resolved.extractors) {
        console.log(`  - ${extractor.name}`);
      }

      if (resolved.pathMappings.length > 0) {
        console.log('');
        console.log(`Path mappings: ${resolved.pathMappings.length}`);
        for (const mapping of resolved.pathMappings) {
          console.log(`  - ${mapping.pattern} -> ${mapping.extractor}`);
        }
      }

      console.log('');
      console.log('Scan config:');
      console.log(`  include: ${resolved.scan.include.join(', ') || '(all)'}`);
      console.log(`  exclude: ${resolved.scan.exclude.join(', ') || '(none)'}`);

      if (resolved.extractors.length === 0 && options.strict) {
        console.error('');
        console.error('Warning: No extractors could be loaded.');
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to resolve configuration:');
      console.error(`  ${(error as Error).message}`);
      process.exit(1);
    }
  },
});
