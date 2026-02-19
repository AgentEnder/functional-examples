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
 * Single snapshot assertion — captures file content for comparison across runs.
 *
 * On first run, the snapshot file is created automatically. On subsequent runs,
 * both the actual file and the stored snapshot are run through the parser
 * pipeline (stripping region markers etc.) before comparison.
 */
const snapshotAssertionSchema = z.strictObject({
  /** Path to the file to snapshot (relative to test cwd) */
  path: z.string(),
  /** Path to store the snapshot file (relative to example root) */
  snapshot: z.string(),
});

/**
 * Captures command output (stdout, stderr, exit code) to a human-readable
 * snapshot file for regression testing.
 *
 * On first run (or when `--update-snapshots` is passed), the snapshot file is
 * created/updated. On subsequent runs the actual output is compared against the
 * stored snapshot.
 *
 * The snapshot file format uses labeled sections:
 * ```
 * === exit code ===
 * 0
 *
 * === stdout ===
 * Hello, world!
 *
 * === stderr ===
 * (empty)
 * ```
 *
 * @example
 * outputSnapshot:
 *   path: ./__snapshots__/my-command.txt
 *   stderr: false   # omit stderr from snapshot
 *   ansi: true      # preserve color codes (default strips them)
 */
const outputSnapshotSchema = z.strictObject({
  /** Path where the snapshot file is stored (relative to example root) */
  path: z.string(),
  /**
   * Include stdout in the snapshot.
   * @default true
   */
  stdout: z.boolean().optional(),
  /**
   * Include stderr in the snapshot.
   * @default true
   */
  stderr: z.boolean().optional(),
  /**
   * Include exit code in the snapshot.
   * @default true
   */
  exitCode: z.boolean().optional(),
  /**
   * Preserve ANSI/VT escape sequences in the snapshot.
   * When false (default), color codes are stripped before writing so the
   * snapshot file is clean plain text.
   * Set to true when the exact color output is part of the contract you want
   * to regression-test.
   * @default false
   */
  ansi: z.boolean().optional(),
});

/**
 * Test assertions
 *
 * Uses z.lazy() for the `not` field to allow recursive self-reference
 * (e.g. `not: { file: { path: 'foo' } }` negates inner assertions).
 */
const assertionsSchema = z
  .strictObject({
    exitCode: z.number().int().optional(),
    stdout: stdioAssertionsSchema,
    stderr: stdioAssertionsSchema,
    file: fileAssertionsSchema,
    files: z.array(fileAssertionSchema).optional(),
    dir: dirAssertionsSchema,
    directories: z.array(dirAssertionSchema).optional(),
    snapshot: snapshotAssertionSchema.optional(),
    snapshots: z.array(snapshotAssertionSchema).optional(),
    get not() {
      return assertionsSchema.optional();
    },
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
  /**
   * When true, ANSI/VT escape sequences are NOT stripped from stdout/stderr
   * before running `contains` and `matches` assertions. Use this when you want
   * to assert that the command produces specific color codes.
   *
   * By default (false), escape sequences are stripped so assertions like
   * `stdout.contains: "error"` work regardless of whether the text is
   * colored red in the actual output.
   *
   * @default false
   */
  maintainVTSequences: z.boolean().optional(),
  /**
   * Capture command output (stdout, stderr, exit code) to a snapshot file for
   * regression testing. See {@link outputSnapshotSchema} for details.
   */
  outputSnapshot: outputSnapshotSchema.optional(),
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
  assertions: assertionsSchema.optional(),
  /**
   * When true, ANSI/VT escape sequences are NOT stripped from stdout/stderr
   * before running `contains` and `matches` assertions. Use this when you want
   * to assert that the command produces specific color codes.
   *
   * By default (false), escape sequences are stripped so assertions like
   * `stdout.contains: "error"` work regardless of whether the text is
   * colored red in the actual output.
   *
   * @default false
   */
  maintainVTSequences: z.boolean().optional(),
  /**
   * Capture this step's output (stdout, stderr, exit code) to a snapshot file
   * for regression testing. See {@link outputSnapshotSchema} for details.
   */
  outputSnapshot: outputSnapshotSchema.optional(),
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
  assertions: assertionsSchema.optional(),
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
export type SnapshotAssertion = z.infer<typeof snapshotAssertionSchema>;
export type OutputSnapshot = z.infer<typeof outputSnapshotSchema>;

// JSON Schema for plugin registration
export const TEST_METADATA_JSON_SCHEMA = z.toJSONSchema(testMetadataSchema);
