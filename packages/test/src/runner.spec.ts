import { describe, it, expect } from 'vitest';
import { runTest, normalizeTests } from './runner.js';
import type { TestCase } from './schema.js';

describe('normalizeTests', () => {
  it('wraps single test in array', () => {
    const single: TestCase = {
      name: 'test',
      options: { command: 'echo hello' },
    };
    expect(normalizeTests(single)).toEqual([single]);
  });

  it('returns array as-is', () => {
    const arr: TestCase[] = [
      { name: 'test1', options: { command: 'echo 1' } },
      { name: 'test2', options: { command: 'echo 2' } },
    ];
    expect(normalizeTests(arr)).toBe(arr);
  });
});

describe('runTest', () => {
  it('passes when command succeeds with no assertions', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'simple echo',
        options: { command: 'echo hello' },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    expect(result.example).toBe('test-example');
    expect(result.test).toBe('simple echo');
    expect(result.actual?.stdout).toContain('hello');
  });

  it('passes with matching exit code', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'exit code test',
        options: { command: 'exit 0' },
        assertions: { exitCode: 0 },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('fails with mismatched exit code', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'exit code test',
        options: { command: 'exit 1' },
        assertions: { exitCode: 0 },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected exit code 0');
  });

  it('passes with stdout contains', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'stdout test',
        options: { command: 'echo "Hello World"' },
        assertions: { stdout: { contains: 'Hello' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('fails with missing stdout content', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'stdout test',
        options: { command: 'echo "Hello"' },
        assertions: { stdout: { contains: 'World' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected stdout to contain');
  });

  it('passes with stdout regex match', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'regex test',
        options: { command: 'echo "Hello World 123"' },
        assertions: { stdout: { matches: 'World \\d+' } },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });
});
