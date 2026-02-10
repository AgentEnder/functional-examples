import { spawn } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { isAbsolute, join } from 'path';
import type { TestCase, TestAssertions, OptionsTestCase, StepsTestCase } from './schema.js';
import type { TestResult } from './reporters/types.js';

interface ExecuteOptions {
  cwd: string;
  env?: Record<string, string>;
  timeout: number;
}

interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
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

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
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
 * Check assertions against actual output
 */
function checkAssertions(
  assertions: TestAssertions | undefined,
  actual: ExecuteResult,
  cwd: string
): string[] {
  const failures: string[] = [];
  if (!assertions) return failures;

  if (assertions.exitCode !== undefined && actual.exitCode !== assertions.exitCode) {
    failures.push(
      `Expected exit code ${assertions.exitCode}, got ${actual.exitCode}`
    );
  }

  if (assertions.stdout?.contains && !actual.stdout.includes(assertions.stdout.contains)) {
    failures.push(
      `Expected stdout to contain "${assertions.stdout.contains}"`
    );
  }

  if (assertions.stdout?.matches) {
    try {
      const regex = new RegExp(assertions.stdout.matches);
      if (!regex.test(actual.stdout)) {
        failures.push(
          `Expected stdout to match /${assertions.stdout.matches}/`
        );
      }
    } catch {
      failures.push(`Invalid stdout regex: ${assertions.stdout.matches}`);
    }
  }

  if (assertions.stderr?.contains && !actual.stderr.includes(assertions.stderr.contains)) {
    failures.push(
      `Expected stderr to contain "${assertions.stderr.contains}"`
    );
  }

  if (assertions.stderr?.matches) {
    try {
      const regex = new RegExp(assertions.stderr.matches);
      if (!regex.test(actual.stderr)) {
        failures.push(
          `Expected stderr to match /${assertions.stderr.matches}/`
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
          const regex = new RegExp(fileAssertion.matches);
          if (!regex.test(content)) {
            failures.push(
              `Expected file "${fileAssertion.path}" to match /${fileAssertion.matches}/`
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
    const innerFailures = checkAssertions(assertions.not, actual, cwd);
    if (innerFailures.length === 0) {
      failures.push('Expected NOT: all negated assertions passed but should have failed');
    }
  }

  return failures;
}

export interface RunTestOptions {
  timeout: number;
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

      // Use explicit assertions if provided, otherwise assert exitCode 0
      const assertions = step.assertions ?? { exitCode: 0 };
      const failures = checkAssertions(assertions, actual, cwd);

      if (failures.length > 0) {
        return {
          example: exampleId,
          test: testCase.name,
          passed: false,
          duration: Date.now() - startTime,
          error: failures.map((f) => `Step ${i + 1}: ${f}`).join('\n'),
          actual,
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
    actual: lastActual,
  };
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
  if ('steps' in testCase) {
    return runSteps(exampleId, examplePath, testCase as StepsTestCase, options);
  }

  const tc = testCase as OptionsTestCase;
  const startTime = Date.now();
  const cwd = tc.options.cwd
    ? join(examplePath, tc.options.cwd)
    : examplePath;

  try {
    const actual = await executeCommand(tc.options.command, {
      cwd,
      env: tc.options.env,
      timeout: tc.options.timeout ?? options.timeout,
    });

    const failures = checkAssertions(tc.assertions, actual, cwd);

    return {
      example: exampleId,
      test: testCase.name,
      passed: failures.length === 0,
      duration: Date.now() - startTime,
      error: failures.length > 0 ? failures.join('\n') : undefined,
      actual,
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
