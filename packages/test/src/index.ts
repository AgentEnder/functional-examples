import type { CLI } from 'cli-forge';
import type { Plugin, ValidationResult } from '@functional-examples/devkit';
import { z } from 'zod';
import { createTestCommands } from './commands/index.js';
import { resolveReporters } from './reporters/resolve.js';
import type { TestMetadata } from './schema.js';
import { TEST_METADATA_JSON_SCHEMA, testMetadataSchema } from './schema.js';
import type { TestPluginOptions } from './types.js';

function mapZodIssue(
  zIssue: z.core.$ZodIssue
): ValidationResult['errors'][number] {
  return {
    path: zIssue.path.join('.'),
    message: zIssue.message,
  };
}

/**
 * Validate test metadata using Zod schema
 */
function validateTestMetadata(metadata: unknown): ValidationResult {
  const result = testMetadataSchema.safeParse(metadata);
  if (result.success) {
    return { success: true, errors: [] };
  }

  if (result.error.issues.length === 1) {
    const issue = result.error.issues[0];
    if (issue.code === 'invalid_union' && issue.errors.length > 0) {
      // Type assertion needed because Zod 4's invalid_union has errors typed as
      // $ZodIssue[][] | [] (union with empty tuple), which confuses TypeScript
      const unionErrors = issue.errors as z.core.$ZodIssue[][];
      const issuesFromUnionMembersWithCorrectType =
        unionErrors.length > 1
          ? unionErrors.filter(
              (zErr) => !zErr.find((err) => err.code === 'invalid_type')
            )
          : [];
      if (issuesFromUnionMembersWithCorrectType.length === 1) {
        return {
          success: false,
          errors: issuesFromUnionMembersWithCorrectType[0].map(mapZodIssue),
        };
      }
    }
  }

  return {
    success: false,
    errors: [
      {
        path: '',
        message: z.prettifyError(result.error),
        ...result.error,
      },
    ],
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
export type {
  Reporter,
  ReporterConfig,
  ReporterFactory,
  TestResult,
  TestSummary,
} from './reporters/types.js';
export type {
  CommandStep,
  DirAssertions,
  FileAssertions,
  OptionsTestCase,
  StepsTestCase,
  TestAssertions,
  TestCase,
  TestMetadata,
  TestOptions,
  TestStep,
} from './schema.js';
export type { TestPluginOptions } from './types.js';

// Re-export reporter factories for custom compositions
export { createPrettyReporter } from './reporters/pretty.js';
export { createTapReporter } from './reporters/tap.js';
