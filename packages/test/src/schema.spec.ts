import { describe, it, expect } from 'vitest';
import { testCaseSchema, testMetadataSchema } from './schema.js';

describe('testCaseSchema', () => {
  it('validates minimal test case', () => {
    const result = testCaseSchema.safeParse({
      name: 'my test',
      options: { command: 'node index.js' },
    });
    expect(result.success).toBe(true);
  });

  it('validates full test case', () => {
    const result = testCaseSchema.safeParse({
      name: 'full test',
      options: {
        command: 'node index.js',
        cwd: './src',
        env: { NODE_ENV: 'test' },
        timeout: 5000,
      },
      assertions: {
        exitCode: 0,
        stdout: { contains: 'Hello', matches: 'Hello.*World' },
        stderr: { contains: 'warning' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = testCaseSchema.safeParse({
      options: { command: 'node index.js' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing command', () => {
    const result = testCaseSchema.safeParse({
      name: 'my test',
      options: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('testMetadataSchema', () => {
  it('validates single test', () => {
    const result = testMetadataSchema.safeParse({
      test: {
        name: 'single',
        options: { command: 'echo hello' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates array of tests', () => {
    const result = testMetadataSchema.safeParse({
      test: [
        { name: 'first', options: { command: 'echo 1' } },
        { name: 'second', options: { command: 'echo 2' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('allows missing test field', () => {
    const result = testMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
