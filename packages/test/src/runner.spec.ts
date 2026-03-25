import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runTest, normalizeTests, buildRegex } from './runner.js';
import type { TestCase } from './schema.js';

describe('buildRegex', () => {
  it('applies s flag by default so . matches newlines', () => {
    const re = buildRegex('Hello.*World');
    expect(re.flags).toContain('s');
    expect(re.test('Hello\nWorld')).toBe(true);
  });

  it('plain pattern matches multi-line stdout (the ArgumentsOf bug)', () => {
    const re = buildRegex('Hello, John!.*You are 42 years old\\.');
    expect(re.test('Hello, John!\nYou are 42 years old.\n')).toBe(true);
  });

  it('regex literal preserves its explicit flags and does not add defaults', () => {
    const re = buildRegex('/hello/i');
    expect(re.flags).toBe('i');
    expect(re.source).toBe('hello');
  });

  it('regex literal with no flags uses empty flags (not s)', () => {
    const re = buildRegex('/Hello.*World/');
    expect(re.flags).toBe('');
    expect(re.test('Hello\nWorld')).toBe(false);
  });

  it('regex literal with s flag matches newlines', () => {
    const re = buildRegex('/Hello.*World/s');
    expect(re.test('Hello\nWorld')).toBe(true);
  });

  it('regex literal with multiple flags preserves all of them', () => {
    const re = buildRegex('/hello.*world/si');
    expect(re.flags).toContain('s');
    expect(re.flags).toContain('i');
    expect(re.test('Hello\nWorld')).toBe(true);
  });
});

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

  it('fails when command exits non-zero with no assertions (defaults to exitCode 0)', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'implicit exit 0',
        options: { command: 'exit 1' },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected exit code 0');
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

describe('runTest (steps format)', () => {
  it('passes when all steps succeed', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'multi-step',
        steps: [
          { command: 'echo step1' },
          { command: 'echo step2' },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    expect(result.example).toBe('test-example');
    expect(result.test).toBe('multi-step');
    expect(result.actual?.stdout).toContain('step2');
  });

  it('stops on first failing step', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'fail-mid',
        steps: [
          { command: 'echo step1' },
          { command: 'exit 1' },
          { command: 'echo step3' },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Step 2');
    expect(result.error).toContain('Expected exit code 0');
  });

  it('implicitly asserts exitCode 0 when no assertions given', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'implicit assertion',
        steps: [{ command: 'exit 1' }],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Step 1');
    expect(result.error).toContain('Expected exit code 0');
  });

  it('uses explicit assertions when provided', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'explicit assertion',
        steps: [
          {
            command: 'echo "hello world"',
            assertions: {
              exitCode: 0,
              stdout: { contains: 'hello' },
            },
          },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('tracks cumulative duration', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'duration',
        steps: [
          { command: 'echo a' },
          { command: 'echo b' },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.duration).toBeGreaterThan(0);
  });

  it('returns actual output from last step', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'last output',
        steps: [
          { command: 'echo first' },
          { command: 'echo last' },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    expect(result.actual?.stdout).toContain('last');
  });

  it('inherits default env from options', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'default env',
        options: { env: { MY_VAR: 'from-defaults' } },
        steps: [
          {
            command: 'node -e "process.stdout.write(process.env.MY_VAR)"',
            assertions: { stdout: { contains: 'from-defaults' } },
          },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('step env overrides default env', async () => {
    const result = await runTest(
      'test-example',
      process.cwd(),
      {
        name: 'env override',
        options: { env: { MY_VAR: 'default', OTHER: 'kept' } },
        steps: [
          {
            command:
              'node -e "process.stdout.write(process.env.MY_VAR + \' \' + process.env.OTHER)"',
            env: { MY_VAR: 'overridden' },
            assertions: { stdout: { contains: 'overridden kept' } },
          },
        ],
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });
});

describe('runTest (file/dir/not assertions)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fe-runner-'));
    writeFileSync(join(tmpDir, 'hello.txt'), 'Hello World\nLine 2\n');
    mkdirSync(join(tmpDir, 'subdir'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('file assertion passes when file exists', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'file exists',
        options: { command: 'echo ok' },
        assertions: { file: { path: './hello.txt' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('file assertion fails when file is missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'file missing',
        options: { command: 'echo ok' },
        assertions: { file: { path: './nope.txt' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected file to exist');
  });

  it('file assertion with contains passes', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'file contains',
        options: { command: 'echo ok' },
        assertions: { file: { path: './hello.txt', contains: 'Hello' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('file assertion with contains fails when content missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'file not contains',
        options: { command: 'echo ok' },
        assertions: { file: { path: './hello.txt', contains: 'Goodbye' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('to contain');
  });

  it('file assertion with matches passes', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'file matches',
        options: { command: 'echo ok' },
        assertions: { file: { path: './hello.txt', matches: 'Hello\\s+World' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('dir assertion passes when directory exists', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'dir exists',
        options: { command: 'echo ok' },
        assertions: { dir: { path: './subdir' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('dir assertion fails when directory is missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'dir missing',
        options: { command: 'echo ok' },
        assertions: { dir: { path: './nope' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected directory to exist');
  });

  it('dir assertion fails when path is a file', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'dir is file',
        options: { command: 'echo ok' },
        assertions: { dir: { path: './hello.txt' } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected directory to exist');
  });

  it('not: { file } passes when file is missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'not file',
        options: { command: 'echo ok' },
        assertions: { not: { file: { path: './nope.txt' } } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('not: { file } fails when file exists', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'not file exists',
        options: { command: 'echo ok' },
        assertions: { not: { file: { path: './hello.txt' } } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected NOT');
  });

  it('not: { stdout: { contains } } passes when string absent', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'not stdout',
        options: { command: 'echo hello' },
        assertions: { not: { stdout: { contains: 'error' } } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('not: { stdout: { contains } } fails when string present', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'not stdout present',
        options: { command: 'echo error occurred' },
        assertions: { not: { stdout: { contains: 'error' } } },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected NOT');
  });

  it('files array checks multiple files', async () => {
    writeFileSync(join(tmpDir, 'second.txt'), 'Second file content');
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'files array',
        options: { command: 'echo ok' },
        assertions: {
          files: [
            { path: './hello.txt', contains: 'Hello' },
            { path: './second.txt', contains: 'Second' },
          ],
        },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('files array fails if any file is missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'files missing',
        options: { command: 'echo ok' },
        assertions: {
          files: [
            { path: './hello.txt' },
            { path: './missing.txt' },
          ],
        },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected file to exist: ./missing.txt');
  });

  it('directories array checks multiple directories', async () => {
    mkdirSync(join(tmpDir, 'subdir2'));
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'dirs array',
        options: { command: 'echo ok' },
        assertions: {
          directories: [
            { path: './subdir' },
            { path: './subdir2' },
          ],
        },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(true);
  });

  it('directories array fails if any directory is missing', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'dirs missing',
        options: { command: 'echo ok' },
        assertions: {
          directories: [
            { path: './subdir' },
            { path: './nope' },
          ],
        },
      },
      { timeout: 5000 }
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Expected directory to exist: ./nope');
  });
});

describe('runTest (snapshot assertions)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fe-snap-'));
    writeFileSync(join(tmpDir, 'output.txt'), 'Hello World\n');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates snapshot on first run', async () => {
    const snapshotPath = join(tmpDir, '__snapshots__', 'output.txt');
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'first run',
        options: { command: 'echo ok' },
        assertions: {
          snapshot: { path: './output.txt', snapshot: './__snapshots__/output.txt' },
        },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    const { existsSync, readFileSync } = await import('fs');
    expect(existsSync(snapshotPath)).toBe(true);
    expect(readFileSync(snapshotPath, 'utf-8')).toBe('Hello World\n');
  });

  it('passes when snapshot matches', async () => {
    // Create snapshot first
    mkdirSync(join(tmpDir, '__snapshots__'));
    writeFileSync(join(tmpDir, '__snapshots__', 'output.txt'), 'Hello World\n');

    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'match',
        options: { command: 'echo ok' },
        assertions: {
          snapshot: { path: './output.txt', snapshot: './__snapshots__/output.txt' },
        },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
  });

  it('fails when snapshot mismatches', async () => {
    // Create snapshot with different content
    mkdirSync(join(tmpDir, '__snapshots__'));
    writeFileSync(join(tmpDir, '__snapshots__', 'output.txt'), 'Different content\n');

    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'mismatch',
        options: { command: 'echo ok' },
        assertions: {
          snapshot: { path: './output.txt', snapshot: './__snapshots__/output.txt' },
        },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Snapshot mismatch');
    expect(result.error).toContain('--update-snapshots');
  });

  it('overwrites snapshot with --update-snapshots', async () => {
    mkdirSync(join(tmpDir, '__snapshots__'));
    writeFileSync(join(tmpDir, '__snapshots__', 'output.txt'), 'Old content\n');

    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'update',
        options: { command: 'echo ok' },
        assertions: {
          snapshot: { path: './output.txt', snapshot: './__snapshots__/output.txt' },
        },
      },
      { timeout: 5000, updateSnapshots: true }
    );

    expect(result.passed).toBe(true);
    const { readFileSync } = await import('fs');
    expect(readFileSync(join(tmpDir, '__snapshots__', 'output.txt'), 'utf-8')).toBe('Hello World\n');
  });

  it('fails when source file does not exist', async () => {
    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'no source',
        options: { command: 'echo ok' },
        assertions: {
          snapshot: { path: './nonexistent.txt', snapshot: './__snapshots__/x.txt' },
        },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Snapshot source file not found');
  });

  it('supports snapshots array', async () => {
    writeFileSync(join(tmpDir, 'second.txt'), 'Second\n');

    const result = await runTest(
      'test-example',
      tmpDir,
      {
        name: 'array',
        options: { command: 'echo ok' },
        assertions: {
          snapshots: [
            { path: './output.txt', snapshot: './__snapshots__/output.txt' },
            { path: './second.txt', snapshot: './__snapshots__/second.txt' },
          ],
        },
      },
      { timeout: 5000 }
    );

    expect(result.passed).toBe(true);
    const { existsSync } = await import('fs');
    expect(existsSync(join(tmpDir, '__snapshots__', 'output.txt'))).toBe(true);
    expect(existsSync(join(tmpDir, '__snapshots__', 'second.txt'))).toBe(true);
  });
});
