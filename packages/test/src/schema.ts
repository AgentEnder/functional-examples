import { z } from 'zod';

/**
 * Assertions for stdout/stderr output
 */
const stdioAssertionsSchema = z
  .strictObject({
    contains: z.string().optional(),
    matches: z.string().optional(),
  })
  .optional();

/**
 * Single file assertion — existence and optional content checks
 */
const fileAssertionSchema = z.strictObject({
  path: z.string(),
  contains: z.string().optional(),
  matches: z.string().optional(),
});

const fileAssertionsSchema = fileAssertionSchema.optional();

/**
 * Single directory assertion — existence check
 */
const dirAssertionSchema = z.strictObject({
  path: z.string(),
});

const dirAssertionsSchema = dirAssertionSchema.optional();

/**
 * Test assertions
 *
 * Uses z.lazy() for the `not` field to allow recursive self-reference
 * (e.g. `not: { file: { path: 'foo' } }` negates inner assertions).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assertionsSchema: z.ZodOptional<any> = z
  .strictObject({
    exitCode: z.number().int().optional(),
    stdout: stdioAssertionsSchema,
    stderr: stdioAssertionsSchema,
    file: fileAssertionsSchema,
    files: z.array(fileAssertionSchema).optional(),
    dir: dirAssertionsSchema,
    directories: z.array(dirAssertionSchema).optional(),
    not: z.lazy(() => assertionsSchema).optional(),
  })
  .optional();

/**
 * Shared execution defaults (cwd, env, timeout) — no command
 */
const testDefaultsSchema = z.strictObject({
  /** Working directory relative to example */
  cwd: z.string().optional(),
  /** Environment variables */
  env: z.record(z.string(), z.string()).optional(),
  /** Timeout in milliseconds */
  timeout: z.number().int().positive().optional(),
});

/**
 * Test execution options (single-command format)
 */
const testOptionsSchema = testDefaultsSchema.extend({
  /** Command to execute */
  command: z.string(),
});

/**
 * A command step in a multi-step sequence
 */
export const commandStepSchema = z.strictObject({
  /** Command to execute */
  command: z.string(),
  /** Working directory relative to example */
  cwd: z.string().optional(),
  /** Environment variables */
  env: z.record(z.string(), z.string()).optional(),
  /** Timeout in milliseconds */
  timeout: z.number().int().positive().optional(),
  /** Assertions for this step (defaults to exitCode === 0 if omitted) */
  assertions: assertionsSchema,
});

/**
 * Step union — currently only command steps, extensible later
 */
const testStepSchema = commandStepSchema;

/**
 * Single test case — supports either options+assertions or steps format
 */
const optionsTestCaseSchema = z.strictObject({
  /** Test name */
  name: z.string(),
  options: testOptionsSchema,
  assertions: assertionsSchema,
});

const stepsTestCaseSchema = z.strictObject({
  /** Test name */
  name: z.string(),
  /** Default cwd, env, timeout inherited by all steps */
  options: testDefaultsSchema.optional(),
  steps: z.array(testStepSchema).min(1),
});

export const testCaseSchema = z.union([
  optionsTestCaseSchema,
  stepsTestCaseSchema,
]);

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
export type OptionsTestCase = z.infer<typeof optionsTestCaseSchema>;
export type StepsTestCase = z.infer<typeof stepsTestCaseSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestDefaults = z.infer<typeof testDefaultsSchema>;
export type TestOptions = z.infer<typeof testOptionsSchema>;
export type TestAssertions = z.infer<typeof assertionsSchema>;
export type TestMetadata = z.infer<typeof testMetadataSchema>;
export type CommandStep = z.infer<typeof commandStepSchema>;
export type TestStep = z.infer<typeof testStepSchema>;
export type FileAssertions = z.infer<typeof fileAssertionsSchema>;
export type DirAssertions = z.infer<typeof dirAssertionsSchema>;

// JSON Schema for plugin registration
export const TEST_METADATA_JSON_SCHEMA = z.toJSONSchema(testMetadataSchema);
