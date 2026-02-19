import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { stat } from 'fs/promises';
import { dirname, extname, isAbsolute, join } from 'path';
import type { ResolvedConfig } from '@functional-examples/devkit';
import type { TestCase, TestAssertions, OptionsTestCase, StepsTestCase, OutputSnapshot } from './schema.js';
import type { TestResult } from './reporters/types.js';

const REGEX_LITERAL = /^\/(.+)\/([gimsuy]*)$/s;
const DEFAULT_FLAGS = 's';

/**
 * Strips ANSI/VT escape sequences from a string.
 *
 * Covers:
 * - CSI sequences: ESC [ <params> <final-byte>  (colors, cursor movement, etc.)
 * - OSC sequences: ESC ] <content> BEL-or-ST
 * - Other two-character ESC sequences: ESC <byte in 0x40–0x5F>
 */
const VT_STRIP_RE =
  /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g;

export function stripVT(s: string): string {
  return s.replace(VT_STRIP_RE, '');
}

/**
 * Build a RegExp from a pattern string. If the string is a regex literal
 * (/pattern/flags), the embedded flags are used as-is. Otherwise the
 * DEFAULT_FLAGS are applied so that `.` matches newlines across multi-line
 * command output.
 */
export function buildRegex(pattern: string): RegExp {
  const match = REGEX_LITERAL.exec(pattern);
  if (match) {
    return new RegExp(match[1], match[2]);
  }
  return new RegExp(pattern, DEFAULT_FLAGS);
}

interface ExecuteOptions {
  cwd: string;
  env?: Record<string, string>;
  timeout: number;
}

interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** stdout and stderr merged in arrival order */
  interleaved: string;
}

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string,
  options: ExecuteOptions
): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let interleaved = '';

    proc.stdout.on('data', (data) => {
      const s = data.toString();
      stdout += s;
      interleaved += s;
    });

    proc.stderr.on('data', (data) => {
      const s = data.toString();
      stderr += s;
      interleaved += s;
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        interleaved,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Resolve an assertion path relative to the test's working directory.
 */
function resolveAssertionPath(baseCwd: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : join(baseCwd, filePath);
}

/**
 * Run content through the parser pipeline to strip region markers
 * and other parser-managed syntax, enabling region-transparent comparison.
 */
async function parseContent(
  content: string,
  filePath: string,
  config?: ResolvedConfig
): Promise<string> {
  if (!config) return content;

  const ext = extname(filePath);
  const parsers = config.registry.getParsersForExtension(ext);
  if (parsers.length === 0) return content;

  // Dynamically import to avoid hard dep on functional-examples at runtime
  // when no snapshots are used
  const { createInitialContext, runParsePipeline } = await import(
    'functional-examples'
  );

  const ctx = createInitialContext(filePath, content, { startTag: 'region', endTag: 'endregion' });
  const result = await runParsePipeline(ctx, parsers);
  return result.parsed;
}

/**
 * Check snapshot assertions — compare actual file content to stored snapshot
 * after running both through the parser pipeline (region-transparent).
 */
async function checkSnapshotAssertions(
  assertions: TestAssertions | undefined,
  cwd: string,
  examplePath: string,
  options: RunTestOptions
): Promise<string[]> {
  const failures: string[] = [];
  if (!assertions) return failures;

  const snapshotChecks = [
    ...(assertions.snapshot ? [assertions.snapshot] : []),
    ...(assertions.snapshots ?? []),
  ];

  for (const snap of snapshotChecks) {
    const actualPath = resolveAssertionPath(cwd, snap.path);
    const snapshotPath = resolveAssertionPath(examplePath, snap.snapshot);

    if (!existsSync(actualPath)) {
      failures.push(`Snapshot source file not found: ${snap.path}`);
      continue;
    }

    const actualContent = readFileSync(actualPath, 'utf-8');

    if (!existsSync(snapshotPath) || options.updateSnapshots) {
      // First run or update mode — write snapshot
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, actualContent, 'utf-8');
      continue;
    }

    // Compare through parser pipeline
    const snapshotContent = readFileSync(snapshotPath, 'utf-8');

    const parsedActual = await parseContent(
      actualContent,
      actualPath,
      options.config
    );
    const parsedSnapshot = await parseContent(
      snapshotContent,
      snapshotPath,
      options.config
    );

    if (parsedActual !== parsedSnapshot) {
      failures.push(
        `Snapshot mismatch for "${snap.path}" (snapshot: "${snap.snapshot}"). ` +
          `Run with --update-snapshots to update.`
      );
    }
  }

  return failures;
}

/**
 * Build the text content for an output snapshot file.
 *
 * Format:
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
 */
function buildOutputSnapshotContent(
  snap: OutputSnapshot,
  actual: ExecuteResult
): string {
  const includeExitCode = snap.exitCode !== false;
  const includeStdout = snap.stdout !== false;
  const includeStderr = snap.stderr !== false;

  const prepare = (s: string) => (snap.ansi ? s : stripVT(s));

  const sections: string[] = [];

  if (includeExitCode) {
    sections.push(`=== exit code ===\n${actual.exitCode}`);
  }
  if (includeStdout) {
    const content = prepare(actual.stdout).trimEnd();
    sections.push(`=== stdout ===\n${content || '(empty)'}`);
  }
  if (includeStderr) {
    const content = prepare(actual.stderr).trimEnd();
    sections.push(`=== stderr ===\n${content || '(empty)'}`);
  }

  return sections.join('\n\n') + '\n';
}

/**
 * Check (or create/update) an output snapshot — compares command stdout/stderr/exitCode
 * against a stored snapshot file.
 */
async function checkOutputSnapshot(
  snap: OutputSnapshot,
  actual: ExecuteResult,
  examplePath: string,
  updateSnapshots: boolean
): Promise<string[]> {
  const snapshotPath = resolveAssertionPath(examplePath, snap.path);
  const content = buildOutputSnapshotContent(snap, actual);

  if (!existsSync(snapshotPath) || updateSnapshots) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, content, 'utf-8');
    return [];
  }

  const stored = readFileSync(snapshotPath, 'utf-8');
  if (content !== stored) {
    return [
      `Output snapshot mismatch (snapshot: "${snap.path}"). ` +
        `Run with --update-snapshots to update.`,
    ];
  }
  return [];
}

/**
 * Check assertions against actual output.
 *
 * @param maintainVTSequences - When true, skip stripping ANSI/VT escape
 *   sequences from stdout/stderr before running `contains`/`matches` checks.
 */
function checkAssertions(
  assertions: TestAssertions | undefined,
  actual: ExecuteResult,
  cwd: string,
  maintainVTSequences?: boolean
): string[] {
  const failures: string[] = [];
  if (!assertions) return failures;

  const prepareOutput = (s: string) =>
    maintainVTSequences ? s : stripVT(s);

  if (assertions.exitCode !== undefined && actual.exitCode !== assertions.exitCode) {
    failures.push(
      `Expected exit code ${assertions.exitCode}, got ${actual.exitCode}`
    );
  }

  const stdout = prepareOutput(actual.stdout);
  const stderr = prepareOutput(actual.stderr);

  if (assertions.stdout?.contains && !stdout.includes(assertions.stdout.contains)) {
    failures.push(
      `Expected stdout to contain "${assertions.stdout.contains}"`
    );
  }

  if (assertions.stdout?.matches) {
    try {
      const regex = buildRegex(assertions.stdout.matches);
      if (!regex.test(stdout)) {
        failures.push(
          `Expected stdout to match ${regex}`
        );
      }
    } catch {
      failures.push(`Invalid stdout regex: ${assertions.stdout.matches}`);
    }
  }

  if (assertions.stderr?.contains && !stderr.includes(assertions.stderr.contains)) {
    failures.push(
      `Expected stderr to contain "${assertions.stderr.contains}"`
    );
  }

  if (assertions.stderr?.matches) {
    try {
      const regex = buildRegex(assertions.stderr.matches);
      if (!regex.test(stderr)) {
        failures.push(
          `Expected stderr to match ${regex}`
        );
      }
    } catch {
      failures.push(`Invalid stderr regex: ${assertions.stderr.matches}`);
    }
  }

  // File existence and content assertions (singular + array)
  const fileChecks = [
    ...(assertions.file ? [assertions.file] : []),
    ...(assertions.files ?? []),
  ];
  for (const fileAssertion of fileChecks) {
    const resolved = resolveAssertionPath(cwd, fileAssertion.path);
    if (!existsSync(resolved)) {
      failures.push(`Expected file to exist: ${fileAssertion.path}`);
    } else {
      const content = readFileSync(resolved, 'utf-8');

      if (fileAssertion.contains && !content.includes(fileAssertion.contains)) {
        failures.push(
          `Expected file "${fileAssertion.path}" to contain "${fileAssertion.contains}"`
        );
      }

      if (fileAssertion.matches) {
        try {
          const regex = buildRegex(fileAssertion.matches);
          if (!regex.test(content)) {
            failures.push(
              `Expected file "${fileAssertion.path}" to match ${regex}`
            );
          }
        } catch {
          failures.push(`Invalid file regex: ${fileAssertion.matches}`);
        }
      }
    }
  }

  // Directory existence assertions (singular + array)
  const dirChecks = [
    ...(assertions.dir ? [assertions.dir] : []),
    ...(assertions.directories ?? []),
  ];
  for (const dirAssertion of dirChecks) {
    const resolved = resolveAssertionPath(cwd, dirAssertion.path);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      failures.push(`Expected directory to exist: ${dirAssertion.path}`);
    }
  }

  // Negation wrapper — inverts pass/fail of inner assertions
  if (assertions.not) {
    const innerFailures = checkAssertions(assertions.not, actual, cwd, maintainVTSequences);
    if (innerFailures.length === 0) {
      failures.push('Expected NOT: all negated assertions passed but should have failed');
    }
  }

  return failures;
}

/** Returns true if all failures are exit-code-only (used by reporters) */
function isExitCodeOnlyFailure(failures: string[]): boolean {
  return failures.length > 0 && failures.every((f) => f.startsWith('Expected exit code'));
}

export interface RunTestOptions {
  timeout: number;
  /** Resolved config for parser pipeline access (needed by snapshot assertions) */
  config?: ResolvedConfig;
  /** When true, overwrite existing snapshots with actual content */
  updateSnapshots?: boolean;
}

/**
 * Run a multi-step test case sequentially.
 * Stops on the first step failure. Steps with no assertions
 * implicitly assert exitCode === 0.
 */
async function runSteps(
  exampleId: string,
  examplePath: string,
  testCase: StepsTestCase,
  options: RunTestOptions
): Promise<TestResult> {
  const startTime = Date.now();
  let lastActual: ExecuteResult | undefined;
  const defaults = testCase.options;

  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i];
    const stepCwd = step.cwd ?? defaults?.cwd;
    const cwd = stepCwd ? join(examplePath, stepCwd) : examplePath;
    const env = defaults?.env || step.env
      ? { ...defaults?.env, ...step.env }
      : undefined;

    try {
      const actual = await executeCommand(step.command, {
        cwd,
        env,
        timeout: step.timeout ?? defaults?.timeout ?? options.timeout,
      });

      lastActual = actual;

      if (step.outputSnapshot) {
        await checkOutputSnapshot(
          step.outputSnapshot,
          actual,
          examplePath,
          options.updateSnapshots ?? false
        );
      }

      // Use explicit assertions if provided, otherwise assert exitCode 0
      const assertions = step.assertions ?? { exitCode: 0 };
      const failures = checkAssertions(assertions, actual, cwd, step.maintainVTSequences);
      const snapshotFailures = await checkSnapshotAssertions(
        assertions,
        cwd,
        examplePath,
        options
      );
      failures.push(...snapshotFailures);

      if (failures.length > 0) {
        return {
          example: exampleId,
          test: testCase.name,
          passed: false,
          duration: Date.now() - startTime,
          error: failures.map((f) => `Step ${i + 1}: ${f}`).join('\n'),
          exitCodeFailure: isExitCodeOnlyFailure(failures),
          actual: {
            exitCode: actual.exitCode,
            stdout: actual.stdout,
            stderr: actual.stderr,
            interleaved: actual.interleaved,
          },
        };
      }
    } catch (err) {
      return {
        example: exampleId,
        test: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        error: `Step ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    example: exampleId,
    test: testCase.name,
    passed: true,
    duration: Date.now() - startTime,
    actual: lastActual
      ? {
          exitCode: lastActual.exitCode,
          stdout: lastActual.stdout,
          stderr: lastActual.stderr,
          interleaved: lastActual.interleaved,
        }
      : undefined,
  };
}

/**
 * Resolve the directory for an example path.
 * Single-file examples use the file's parent directory as the working root.
 */
async function resolveExampleDir(examplePath: string): Promise<string> {
  const s = await stat(examplePath);
  return s.isFile() ? dirname(examplePath) : examplePath;
}

/**
 * Run a single test case against an example.
 * Dispatches to runSteps() for multi-step test cases.
 */
export async function runTest(
  exampleId: string,
  examplePath: string,
  testCase: TestCase,
  options: RunTestOptions
): Promise<TestResult> {
  const exampleDir = await resolveExampleDir(examplePath);

  if ('steps' in testCase) {
    return runSteps(exampleId, exampleDir, testCase as StepsTestCase, options);
  }

  const tc = testCase as OptionsTestCase;
  const startTime = Date.now();
  const cwd = tc.options.cwd
    ? join(exampleDir, tc.options.cwd)
    : exampleDir;

  try {
    const actual = await executeCommand(tc.options.command, {
      cwd,
      env: tc.options.env,
      timeout: tc.options.timeout ?? options.timeout,
    });

    if (tc.options.outputSnapshot) {
      await checkOutputSnapshot(
        tc.options.outputSnapshot,
        actual,
        exampleDir,
        options.updateSnapshots ?? false
      );
    }

    const assertions = tc.assertions ?? { exitCode: 0 };
    const failures = checkAssertions(assertions, actual, cwd, tc.options.maintainVTSequences);
    const snapshotFailures = await checkSnapshotAssertions(
      assertions,
      cwd,
      exampleDir,
      options
    );
    failures.push(...snapshotFailures);

    return {
      example: exampleId,
      test: testCase.name,
      passed: failures.length === 0,
      duration: Date.now() - startTime,
      error: failures.length > 0 ? failures.join('\n') : undefined,
      exitCodeFailure: failures.length > 0 ? isExitCodeOnlyFailure(failures) : undefined,
      actual: {
        exitCode: actual.exitCode,
        stdout: actual.stdout,
        stderr: actual.stderr,
        interleaved: actual.interleaved,
      },
    };
  } catch (err) {
    return {
      example: exampleId,
      test: testCase.name,
      passed: false,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Normalize test field to array
 */
export function normalizeTests(test: TestCase | TestCase[]): TestCase[] {
  return Array.isArray(test) ? test : [test];
}
