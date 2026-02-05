import type { ReporterConfig, ReporterFactory } from './reporters/types.js';

/**
 * Options for the test plugin
 */
export interface TestPluginOptions {
  /**
   * Default timeout for tests in ms
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom reporters keyed by name.
   * Can be a factory function or module path string.
   * Built-in: 'pretty', 'tap'
   */
  reporters?: Record<string, ReporterConfig>;

  /**
   * Default reporter when not in CI
   * @default 'pretty'
   */
  defaultReporter?: string;

  /**
   * Default reporter when in CI
   * @default 'tap'
   */
  ciReporter?: string;
}

/**
 * Resolved options with reporter factories
 */
export interface ResolvedTestPluginOptions {
  timeout: number;
  reporters: Record<string, ReporterFactory>;
  defaultReporter: string;
  ciReporter: string;
}
