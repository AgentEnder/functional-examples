import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Assertions for stdout/stderr output
 */
const stdioAssertionsSchema = z
  .object({
    contains: z.string().optional(),
    matches: z.string().optional(),
  })
  .optional();

/**
 * Test assertions
 */
const assertionsSchema = z
  .object({
    exitCode: z.number().int().optional(),
    stdout: stdioAssertionsSchema,
    stderr: stdioAssertionsSchema,
  })
  .optional();

/**
 * Test execution options
 */
const testOptionsSchema = z.object({
  command: z.string().describe('Command to execute'),
  cwd: z.string().optional().describe('Working directory relative to example'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds'),
});

/**
 * Single test case
 */
export const testCaseSchema = z.object({
  name: z.string().describe('Test name'),
  options: testOptionsSchema,
  assertions: assertionsSchema,
});

/**
 * Test field can be single test or array
 */
const testFieldSchema = z.union([testCaseSchema, z.array(testCaseSchema)]);

/**
 * Metadata extension for test plugin
 */
export const testMetadataSchema = z.object({
  test: testFieldSchema.optional(),
});

// Inferred types
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestOptions = z.infer<typeof testOptionsSchema>;
export type TestAssertions = z.infer<typeof assertionsSchema>;
export type TestMetadata = z.infer<typeof testMetadataSchema>;

// JSON Schema for plugin registration
export const TEST_METADATA_JSON_SCHEMA = zodToJsonSchema(testMetadataSchema, {
  name: 'TestMetadata',
  $refStrategy: 'none',
});
