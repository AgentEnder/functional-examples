/**
 * Validate command - validate configuration and example metadata
 */

import { cli } from 'cli-forge';
import { resolveConfig, ResolvedConfig } from '../../config/resolver.js';
import { validateConfig } from '../../config/validator.js';
import { scanExamples } from '../../scanner/index.js';
import { mergeMetadataSchemas } from '../../schema/merger.js';
import { createSchemaValidator } from '../../schema/validator.js';

export const validateCommand = cli('validate', {
  description: 'Validate configuration and example metadata',
  builder: (cmd) =>
    cmd.option('strict', {
      type: 'boolean',
      description: 'Treat warnings as errors',
      default: false,
    }),
  handler: async (options) => {
    const opts = options as typeof options & { resolvedConfig: ResolvedConfig };
    const config = opts.resolvedConfig;
    const configPath = config.root;

    if (!configPath) {
      console.log('No configuration file found.');
      console.log('Run "functional-examples init" to create one.');
      process.exit(0);
    }

    console.log(`Validating: ${configPath}`);
    console.log('');

    // Phase 1: Validate config structure
    const configErrors = validateConfig(config);

    if (configErrors.length > 0) {
      console.error('Configuration errors:');
      for (const error of configErrors) {
        console.error(`  - ${error.path}: ${error.message}`);
      }
      process.exit(1);
    }

    let resolved: ResolvedConfig;
    try {
      resolved = await resolveConfig(config);
    } catch (error) {
      console.error('Failed to resolve configuration:');
      console.error(`  ${(error as Error).message}`);
      return void process.exit(1);
    }

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

    if (resolved.extractors.length === 0) {
      if (options.strict) {
        console.error('');
        console.error('Warning: No extractors could be loaded.');
        process.exit(1);
      }
      return;
    }

    // Phase 2: Scan examples and validate metadata
    console.log('');
    console.log('Scanning examples...');

    const scanResult = await scanExamples(resolved);

    console.log(
      `Found ${scanResult.examples.length} example(s) in ${scanResult.stats.durationMs}ms`
    );

    if (scanResult.examples.length === 0) {
      if (options.strict) {
        console.error('');
        console.error('Warning: No examples found.');
        process.exit(1);
      }
      return;
    }

    // Phase 3: Validate metadata against the combined schema
    const pluginSchemas = resolved.registry.getSchemas();
    const mergedSchema = mergeMetadataSchemas({
      configSchema: resolved.metadata,
      pluginSchemas,
    });
    delete mergedSchema['$schema'];
    const validateSchema = createSchemaValidator(mergedSchema);

    let metadataErrorCount = 0;
    const exampleErrors: Array<{
      displayPath: string;
      messages: string[];
    }> = [];

    for (const example of scanResult.examples) {
      const result = validateSchema(example.metadata);
      if (!result.success) {
        const messages = result.errors.map(
          (e) => `${e.path || '(root)'}: ${e.message}`
        );
        exampleErrors.push({ displayPath: example.displayPath, messages });
        metadataErrorCount += messages.length;
      }
    }

    // Report scan-level errors (extractor failures, conflicts, etc.)
    if (scanResult.errors.length > 0) {
      console.error('');
      console.error(`Scan errors (${scanResult.errors.length}):`);
      for (const error of scanResult.errors) {
        console.error(`  ${error.path}:`);
        console.error(`    ${error.message}`);
      }
    }

    // Report metadata validation errors
    if (exampleErrors.length > 0) {
      console.error('');
      console.error(
        `Metadata validation errors (${metadataErrorCount} across ${exampleErrors.length} example(s)):`
      );
      for (const { displayPath, messages } of exampleErrors) {
        console.error(`  ${displayPath}:`);
        for (const msg of messages) {
          console.error(`    - ${msg}`);
        }
      }
    }

    const totalErrors = scanResult.errors.length + metadataErrorCount;
    if (totalErrors > 0) {
      console.error('');
      console.error(`Validation failed with ${totalErrors} error(s).`);
      process.exit(1);
    }

    console.log('');
    console.log('All examples pass metadata validation!');
  },
});
