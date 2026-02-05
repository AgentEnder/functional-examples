import type { CLI } from 'cli-forge';
import type { Plugin, ValidationResult } from 'functional-examples';
import { testMetadataSchema, TEST_METADATA_JSON_SCHEMA } from './schema.js';
import type { TestMetadata } from './schema.js';
import type { TestPluginOptions } from './types.js';
import { resolveReporters } from './reporters/resolve.js';
import { createTestCommands } from './commands/index.js';

/**
 * Validate test metadata using Zod schema
 */
function validateTestMetadata(metadata: unknown): ValidationResult {
  const result = testMetadataSchema.safeParse(metadata);
  if (result.success) {
    return { success: true, errors: [] };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Create the test plugin
 */
export function createTestPlugin(
  options: TestPluginOptions = {}
): Plugin<TestMetadata> {
  return {
    name: '@functional-examples/test',
    schemas: {
      metadata: JSON.stringify(TEST_METADATA_JSON_SCHEMA),
    },
    validators: {
      metadata: validateTestMetadata,
    },
    commands: async (config) => {
      const reporters = await resolveReporters(options.reporters);

      return createTestCommands(config, {
        reporters,
        defaultReporter: options.defaultReporter ?? 'pretty',
        ciReporter: options.ciReporter ?? 'tap',
        timeout: options.timeout ?? 30000,
      }) as CLI[];
    },
    _options: options,
  };
}

// Re-export types for consumers
export type { TestPluginOptions } from './types.js';
export type { TestCase, TestMetadata, TestOptions, TestAssertions } from './schema.js';
export type {
  Reporter,
  ReporterFactory,
  ReporterConfig,
  TestResult,
  TestSummary,
} from './reporters/types.js';

// Re-export reporter factories for custom compositions
export { createPrettyReporter } from './reporters/pretty.js';
export { createTapReporter } from './reporters/tap.js';
