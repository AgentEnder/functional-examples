import { spawn } from 'child_process';
import { join } from 'path';
import type { TestCase, TestAssertions } from './schema.js';
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
    const [cmd, ...args] = command.split(/\s+/);
    const proc = spawn(cmd, args, {
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
 * Check assertions against actual output
 */
function checkAssertions(
  assertions: TestAssertions | undefined,
  actual: ExecuteResult
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

  return failures;
}

export interface RunTestOptions {
  timeout: number;
}

/**
 * Run a single test case against an example
 */
export async function runTest(
  exampleId: string,
  examplePath: string,
  testCase: TestCase,
  options: RunTestOptions
): Promise<TestResult> {
  const startTime = Date.now();
  const cwd = testCase.options.cwd
    ? join(examplePath, testCase.options.cwd)
    : examplePath;

  try {
    const actual = await executeCommand(testCase.options.command, {
      cwd,
      env: testCase.options.env,
      timeout: testCase.options.timeout ?? options.timeout,
    });

    const failures = checkAssertions(testCase.assertions, actual);

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
