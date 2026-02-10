import type { Example } from '@functional-examples/devkit';

/**
 * Result of a single test execution
 */
export interface TestResult {
  /** Example ID or path */
  example: string;
  /** Test case name */
  test: string;
  /** Whether the test passed */
  passed: boolean;
  /** Execution duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Actual command output */
  actual?: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

/**
 * Summary of test run
 */
export interface TestSummary {
  passed: number;
  failed: number;
  bail?: boolean;
}

/**
 * Reporter interface for test output
 */
export interface Reporter {
  /** Called before running tests */
  start(examples: Example[]): void | Promise<void>;
  /** Called after each test */
  report(result: TestResult, verbose: boolean): void | Promise<void>;
  /** Called after all tests complete */
  finish(summary: TestSummary): void | Promise<void>;
}

/**
 * Factory function that creates a reporter instance
 */
export type ReporterFactory = () => Reporter;

/**
 * Reporter config can be a factory or module path string
 */
export type ReporterConfig = ReporterFactory | string;
