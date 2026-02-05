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
  /** Command to execute */
  command: z.string(),
  /** Working directory relative to example */
  cwd: z.string().optional(),
  /** Environment variables */
  env: z.record(z.string(), z.string()).optional(),
  /** Timeout in milliseconds */
  timeout: z.number().int().positive().optional(),
});

/**
 * Single test case
 */
export const testCaseSchema = z.object({
  /** Test name */
  name: z.string(),
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
// Note: Cast as any because zod-to-json-schema types may lag behind zod v4
export const TEST_METADATA_JSON_SCHEMA = zodToJsonSchema(
  testMetadataSchema as unknown as Parameters<typeof zodToJsonSchema>[0],
  {
    name: 'TestMetadata',
    $refStrategy: 'none',
  }
);
