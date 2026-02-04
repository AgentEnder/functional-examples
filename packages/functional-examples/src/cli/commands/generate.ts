/**
 * Generate command - create JSON Schema and TypeScript types
 */

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { cli } from 'cli-forge';
import { findConfigFile, loadConfig } from '../../config/loader.js';
import { resolveConfig } from '../../config/resolver.js';
import { mergeConfigSchema, mergeMetadataSchemas } from '../../schema/merger.js';
import { generateMetadataTypes } from '../../schema/typegen.js';

const DEFAULT_OUTPUT_DIR = '.functional-examples';

export const generateCommand = cli('generate', {
  description: 'Generate JSON Schema and TypeScript types from config and plugins',
  builder: (cmd) =>
    cmd
      .option('config', {
        type: 'string',
        alias: ['c'],
        description: 'Path to config file',
      })
      .option('output', {
        type: 'string',
        alias: ['o'],
        description: 'Output directory',
        default: DEFAULT_OUTPUT_DIR,
      }),
  handler: async (options) => {
    try {
      // Load and resolve config
      const configPath = options.config ?? (await findConfigFile(process.cwd()));
      const config = configPath ? await loadConfig(configPath) : {};
      const resolved = await resolveConfig(config);

      // Get schemas from all plugins
      const pluginSchemas = resolved.registry.getSchemas();

      // Determine output directory
      const outputDir = path.resolve(
        process.cwd(),
        options.output ?? (config as { generate?: { outputDir?: string } }).generate?.outputDir ?? DEFAULT_OUTPUT_DIR
      );
      await mkdir(outputDir, { recursive: true });

      // Generate config schema (for IDE autocomplete of config file)
      const configSchema = mergeConfigSchema({ pluginSchemas });
      const schemaPath = path.join(outputDir, 'schema.json');
      await writeFile(schemaPath, JSON.stringify(configSchema, null, 2));
      console.log(`✓ Generated ${schemaPath}`);

      // Merge metadata schemas (config takes priority over plugins)
      const mergedMetadataSchema = mergeMetadataSchemas({
        configSchema: (config as { metadata?: Record<string, unknown> }).metadata,
        pluginSchemas,
      });

      // Generate metadata types from merged schema
      const metadataTypes = generateMetadataTypes({
        mergedSchema: mergedMetadataSchema,
      });
      const typesPath = path.join(outputDir, 'metadata.d.ts');
      await writeFile(typesPath, metadataTypes);
      console.log(`✓ Generated ${typesPath}`);

      // Also output the merged metadata schema for reference
      const metadataSchemaPath = path.join(outputDir, 'metadata.schema.json');
      await writeFile(
        metadataSchemaPath,
        JSON.stringify(mergedMetadataSchema, null, 2)
      );
      console.log(`✓ Generated ${metadataSchemaPath}`);

      console.log('\nDone! Add to your config file:');
      console.log(
        `  "$schema": "./${options.output ?? DEFAULT_OUTPUT_DIR}/schema.json"`
      );
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});
