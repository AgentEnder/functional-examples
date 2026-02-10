import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runTest, normalizeTests } from './runner.js';
import type { TestCase } from './schema.js';

describe('Test Runner Integration', () => {
  let testDir: string;

  beforeAll(async () => {
    // Create a temp directory with test scripts
    testDir = await mkdtemp(join(tmpdir(), 'fe-test-'));

    // Create a passing script
    await writeFile(
      join(testDir, 'pass.js'),
      `console.log('Hello from test');
process.exit(0);
`
    );

    // Create a failing script
    await writeFile(
      join(testDir, 'fail.js'),
      `console.error('Error: something went wrong');
process.exit(1);
`
    );

    // Create a slow script
    await writeFile(
      join(testDir, 'slow.js'),
      `setTimeout(() => {
  console.log('Done');
  process.exit(0);
}, 5000);
`
    );

    // Create a script with env vars
    await writeFile(
      join(testDir, 'env.js'),
      `console.log('VALUE=' + process.env.TEST_VALUE);
`
    );

    // Create a subdirectory with a script
    await mkdir(join(testDir, 'subdir'));
    await writeFile(
      join(testDir, 'subdir', 'nested.js'),
      `console.log('Nested script');
`
    );
  });

  afterAll(async () => {
    // Cleanup temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('runTest', () => {
    it('should pass when all assertions match', async () => {
      const testCase: TestCase = {
        name: 'passes',
        options: {
          command: 'node pass.js',
        },
        assertions: {
          exitCode: 0,
          stdout: {
            contains: 'Hello from test',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
      expect(result.example).toBe('test-example');
      expect(result.test).toBe('passes');
      expect(result.error).toBeUndefined();
      expect(result.actual?.exitCode).toBe(0);
      expect(result.actual?.stdout).toContain('Hello from test');
    });

    it('should fail when exit code does not match', async () => {
      const testCase: TestCase = {
        name: 'wrong exit',
        options: {
          command: 'node pass.js',
        },
        assertions: {
          exitCode: 1,
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Expected exit code 1, got 0');
    });

    it('should fail when stdout does not contain expected text', async () => {
      const testCase: TestCase = {
        name: 'missing text',
        options: {
          command: 'node pass.js',
        },
        assertions: {
          stdout: {
            contains: 'not present',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Expected stdout to contain');
    });

    it('should pass with regex match', async () => {
      const testCase: TestCase = {
        name: 'regex match',
        options: {
          command: 'node pass.js',
        },
        assertions: {
          stdout: {
            matches: 'Hello.*test',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should check stderr assertions', async () => {
      const testCase: TestCase = {
        name: 'stderr check',
        options: {
          command: 'node fail.js',
        },
        assertions: {
          exitCode: 1,
          stderr: {
            contains: 'Error',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
      expect(result.actual?.stderr).toContain('Error');
    });

    it('should pass environment variables', async () => {
      const testCase: TestCase = {
        name: 'env vars',
        options: {
          command: 'node env.js',
          env: {
            TEST_VALUE: 'hello123',
          },
        },
        assertions: {
          stdout: {
            contains: 'VALUE=hello123',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should use custom cwd', async () => {
      const testCase: TestCase = {
        name: 'custom cwd',
        options: {
          command: 'node nested.js',
          cwd: 'subdir',
        },
        assertions: {
          stdout: {
            contains: 'Nested script',
          },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should timeout slow commands', async () => {
      const testCase: TestCase = {
        name: 'slow test',
        options: {
          command: 'node slow.js',
          timeout: 100, // Very short timeout
        },
        assertions: {
          exitCode: 0,
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 30000, // Default timeout
      });

      expect(result.passed).toBe(false);
      expect(result.error).toMatch(/timeout|timed out|SIGTERM/i);
    });

    it('should track duration', async () => {
      const testCase: TestCase = {
        name: 'duration check',
        options: {
          command: 'node pass.js',
        },
        assertions: {
          exitCode: 0,
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(5000); // Should complete quickly
    });
  });

  describe('normalizeTests', () => {
    it('should normalize single test to array', () => {
      const single: TestCase = {
        name: 'single',
        options: { command: 'echo hi' },
      };

      const result = normalizeTests(single);

      expect(result).toEqual([single]);
    });

    it('should pass through array unchanged', () => {
      const tests: TestCase[] = [
        { name: 'first', options: { command: 'echo 1' } },
        { name: 'second', options: { command: 'echo 2' } },
      ];

      const result = normalizeTests(tests);

      expect(result).toEqual(tests);
    });
  });

  describe('runTest (filesystem assertions)', () => {
    it('should assert file existence and content across steps', async () => {
      const testCase: TestCase = {
        name: 'file handoff',
        steps: [
          {
            command: 'echo "generated content" > output.txt',
          },
          {
            command: 'echo ok',
            assertions: {
              file: { path: './output.txt', contains: 'generated content' },
            },
          },
          {
            command: 'rm output.txt',
          },
          {
            command: 'echo ok',
            assertions: {
              not: { file: { path: './output.txt' } },
            },
          },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should assert directory existence', async () => {
      const testCase: TestCase = {
        name: 'dir check',
        options: { command: 'echo ok' },
        assertions: {
          dir: { path: './subdir' },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should negate directory existence', async () => {
      const testCase: TestCase = {
        name: 'not dir',
        options: { command: 'echo ok' },
        assertions: {
          not: { dir: { path: './nonexistent' } },
        },
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('runTest (steps integration)', () => {
    it('should run multi-step with real scripts', async () => {
      const testCase: TestCase = {
        name: 'multi-step scripts',
        steps: [
          {
            command: 'node pass.js',
            assertions: {
              exitCode: 0,
              stdout: { contains: 'Hello from test' },
            },
          },
          {
            command: 'node env.js',
            env: { TEST_VALUE: 'from-step' },
            assertions: {
              stdout: { contains: 'VALUE=from-step' },
            },
          },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
      expect(result.actual?.stdout).toContain('VALUE=from-step');
    });

    it('should stop on first failing step with real scripts', async () => {
      const testCase: TestCase = {
        name: 'fail at step 2',
        steps: [
          { command: 'node pass.js' },
          { command: 'node fail.js' },
          { command: 'node pass.js' },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Step 2');
    });

    it('should support custom cwd in steps', async () => {
      const testCase: TestCase = {
        name: 'cwd step',
        steps: [
          {
            command: 'node nested.js',
            cwd: 'subdir',
            assertions: {
              stdout: { contains: 'Nested script' },
            },
          },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should timeout slow step', async () => {
      const testCase: TestCase = {
        name: 'slow step',
        steps: [
          { command: 'node pass.js' },
          { command: 'node slow.js', timeout: 100 },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 30000,
      });

      expect(result.passed).toBe(false);
      expect(result.error).toMatch(/Step 2.*timeout|Step 2.*timed out/i);
    });

    it('should inherit default cwd from options', async () => {
      const testCase: TestCase = {
        name: 'default cwd',
        options: { cwd: 'subdir' },
        steps: [
          {
            command: 'node nested.js',
            assertions: { stdout: { contains: 'Nested script' } },
          },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });

    it('should inherit default env from options and merge with step env', async () => {
      const testCase: TestCase = {
        name: 'default env',
        options: { env: { TEST_VALUE: 'from-defaults' } },
        steps: [
          {
            command: 'node env.js',
            assertions: { stdout: { contains: 'VALUE=from-defaults' } },
          },
          {
            command: 'node env.js',
            env: { TEST_VALUE: 'overridden' },
            assertions: { stdout: { contains: 'VALUE=overridden' } },
          },
        ],
      };

      const result = await runTest('test-example', testDir, testCase, {
        timeout: 10000,
      });

      expect(result.passed).toBe(true);
    });
  });
});
