import { describe, it, expect } from 'vitest';
import { testCaseSchema, testMetadataSchema, commandStepSchema } from './schema.js';

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

describe('testCaseSchema (steps format)', () => {
  it('validates a test case with steps', () => {
    const result = testCaseSchema.safeParse({
      name: 'multi-step',
      steps: [
        { command: 'echo setup' },
        { command: 'echo verify' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates steps with all options', () => {
    const result = testCaseSchema.safeParse({
      name: 'full steps',
      steps: [
        {
          command: 'node build.js',
          cwd: './src',
          env: { MODE: 'prod' },
          timeout: 10000,
          assertions: {
            exitCode: 0,
            stdout: { contains: 'built' },
          },
        },
        {
          command: 'node verify.js',
          assertions: { exitCode: 0 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty steps array', () => {
    const result = testCaseSchema.safeParse({
      name: 'empty',
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects steps with missing command', () => {
    const result = testCaseSchema.safeParse({
      name: 'bad step',
      steps: [{ cwd: './src' }],
    });
    expect(result.success).toBe(false);
  });

  it('validates steps with default options', () => {
    const result = testCaseSchema.safeParse({
      name: 'with defaults',
      options: {
        cwd: './src',
        env: { NODE_ENV: 'test' },
        timeout: 5000,
      },
      steps: [
        { command: 'echo setup' },
        { command: 'echo verify' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects steps with command in options', () => {
    const result = testCaseSchema.safeParse({
      name: 'bad defaults',
      options: { command: 'echo hi', cwd: './src' },
      steps: [{ command: 'echo bye' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('commandStepSchema', () => {
  it('validates minimal step', () => {
    const result = commandStepSchema.safeParse({
      command: 'echo hello',
    });
    expect(result.success).toBe(true);
  });

  it('validates step with assertions', () => {
    const result = commandStepSchema.safeParse({
      command: 'echo hello',
      assertions: { exitCode: 0, stdout: { contains: 'hello' } },
    });
    expect(result.success).toBe(true);
  });
});

describe('assertionsSchema (file, dir, not)', () => {
  it('validates file with path only (existence check)', () => {
    const result = testCaseSchema.safeParse({
      name: 'file exists',
      options: { command: 'echo hi' },
      assertions: { file: { path: './output.txt' } },
    });
    expect(result.success).toBe(true);
  });

  it('validates file with path + contains + matches', () => {
    const result = testCaseSchema.safeParse({
      name: 'file content',
      options: { command: 'echo hi' },
      assertions: {
        file: { path: './output.txt', contains: 'hello', matches: 'he.*lo' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates dir with path', () => {
    const result = testCaseSchema.safeParse({
      name: 'dir exists',
      options: { command: 'echo hi' },
      assertions: { dir: { path: './output' } },
    });
    expect(result.success).toBe(true);
  });

  it('validates not wrapper with nested assertions', () => {
    const result = testCaseSchema.safeParse({
      name: 'not test',
      options: { command: 'echo hi' },
      assertions: {
        not: { stdout: { contains: 'error' } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates not with file (non-existence)', () => {
    const result = testCaseSchema.safeParse({
      name: 'not file',
      options: { command: 'echo hi' },
      assertions: {
        not: { file: { path: './should-not-exist.txt' } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects file without path', () => {
    const result = testCaseSchema.safeParse({
      name: 'bad file',
      options: { command: 'echo hi' },
      assertions: { file: { contains: 'hello' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects dir without path', () => {
    const result = testCaseSchema.safeParse({
      name: 'bad dir',
      options: { command: 'echo hi' },
      assertions: { dir: {} },
    });
    expect(result.success).toBe(false);
  });

  it('validates files array', () => {
    const result = testCaseSchema.safeParse({
      name: 'files array',
      options: { command: 'echo hi' },
      assertions: {
        files: [
          { path: './a.txt', contains: 'hello' },
          { path: './b.txt', matches: 'world' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates directories array', () => {
    const result = testCaseSchema.safeParse({
      name: 'dirs array',
      options: { command: 'echo hi' },
      assertions: {
        directories: [{ path: './dir1' }, { path: './dir2' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates files and file together', () => {
    const result = testCaseSchema.safeParse({
      name: 'both',
      options: { command: 'echo hi' },
      assertions: {
        file: { path: './main.txt' },
        files: [{ path: './extra.txt' }],
      },
    });
    expect(result.success).toBe(true);
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

  it('validates steps-format test in metadata', () => {
    const result = testMetadataSchema.safeParse({
      test: {
        name: 'steps test',
        steps: [
          { command: 'echo setup' },
          { command: 'echo run' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates mixed array of options and steps tests', () => {
    const result = testMetadataSchema.safeParse({
      test: [
        { name: 'options', options: { command: 'echo 1' } },
        { name: 'steps', steps: [{ command: 'echo 2' }] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('allows missing test field', () => {
    const result = testMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
