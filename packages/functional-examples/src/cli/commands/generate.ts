/**
 * Generate command - create JSON Schema and TypeScript types
 */

import { cli } from 'cli-forge';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ResolvedConfig } from '../../config/resolver.js';
import {
  mergeConfigSchema,
  mergeMetadataSchemas,
} from '../../schema/merger.js';
import { generateTypes } from '../../schema/typegen.js';

const DEFAULT_OUTPUT_DIR = '.functional-examples';

export const generateCommand = cli('generate', {
  description:
    'Generate JSON Schema and TypeScript types from config and plugins',
  builder: (cmd) =>
    cmd.option('output', {
      type: 'string',
      alias: ['o'],
      description: 'Output directory',
      default: DEFAULT_OUTPUT_DIR,
    }),
  handler: async (options) => {
    try {
      // Load and resolve config
      const opts = options as typeof options & {
        resolvedConfig: ResolvedConfig;
      };
      const resolved = opts.resolvedConfig;

      // Get schemas from all plugins
      const pluginSchemas = resolved.registry.getSchemas();

      // Determine output directory
      const outputDir = path.resolve(
        resolved.root,
        options.output ?? resolved.generate?.outputDir ?? DEFAULT_OUTPUT_DIR
      );
      await mkdir(outputDir, { recursive: true });

      // Generate config schema (for IDE autocomplete of config file)
      const configSchema = mergeConfigSchema({ pluginSchemas });
      const schemaPath = path.join(outputDir, 'schema.json');
      await writeFile(schemaPath, JSON.stringify(configSchema, null, 2));
      console.log(`✓ Generated ${schemaPath}`);

      // Merge metadata schemas (config takes priority over plugins)
      const mergedMetadataSchema = mergeMetadataSchemas({
        configSchema: resolved.metadata,
        pluginSchemas,
      });

      const typesPath = path.join(outputDir, 'metadata.d.ts');
      await writeFile(
        typesPath,
        generateTypes({ mergedSchema: mergedMetadataSchema, pluginSchemas })
      );
      console.log(`✓ Generated ${typesPath}`);

      // Also output the merged metadata schema for reference
      const metadataSchemaPath = path.join(outputDir, 'metadata.schema.json');
      await writeFile(
        metadataSchemaPath,
        JSON.stringify(mergedMetadataSchema, null, 2)
      );
      console.log(`✓ Generated ${metadataSchemaPath}`);

      const outputDirName = options.output ?? DEFAULT_OUTPUT_DIR;
      console.log('\nDone! To enable type-safe metadata:');
      console.log('');
      console.log('1. Add to your tsconfig.json include:');
      console.log(`   "${outputDirName}/**/*.d.ts"`);
      console.log('');
      console.log('2. Add to your config file for IDE autocomplete:');
      console.log(`   "$schema": "./${outputDirName}/schema.json"`);
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});
