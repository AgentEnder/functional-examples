import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { createTapReporter } from './tap.js';
import type { TestResult } from './types.js';

const require = createRequire(import.meta.url);
// tap-parser is a CJS Writable stream that parses TAP output
const Parser = require('tap-parser');

/**
 * Collect TAP output from the reporter by capturing stdout, running the
 * reporter callbacks, then parsing the captured output with tap-parser.
 *
 * Returns a promise that resolves with the parsed TAP events once the
 * parser's `complete` event fires.
 */
function collectTap(run: (reporter: ReturnType<typeof createTapReporter>) => void): Promise<{
  plan: { start: number; end: number } | null;
  version: number | null;
  asserts: Array<{ ok: boolean; id: number; name: string; diag?: Record<string, unknown> }>;
  summary: { pass: number; fail: number; count: number } | null;
  raw: string;
}> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' ') + '\n');
    });

    const reporter = createTapReporter();
    run(reporter);

    write.mockRestore();
    log.mockRestore();

    const raw = lines.join('');
    const parser = new Parser();

    const asserts: Array<{ ok: boolean; id: number; name: string; diag?: Record<string, unknown> }> = [];
    let plan: { start: number; end: number } | null = null;
    let version: number | null = null;
    let summary: { pass: number; fail: number; count: number } | null = null;

    parser.on('version', (v: number) => { version = v; });
    parser.on('plan', (p: { start: number; end: number }) => { plan = p; });
    parser.on('assert', (r: { ok: boolean; id: number; name: string; diag?: Record<string, unknown> }) => {
      asserts.push(r);
    });
    parser.on('complete', (results: { pass: number; fail: number; count: number }) => {
      summary = results;
      resolve({ plan, version, asserts, summary, raw });
    });

    parser.end(raw);
  });
}

function makeExample(overrides: Partial<{ id: string; metadata: Record<string, unknown> }> = {}) {
  return {
    id: overrides.id ?? 'example',
    title: 'Example',
    path: '/some/path',
    rootPath: '/some/path',
    files: [],
    extractorName: 'test',
    metadata: overrides.metadata ?? { test: { name: 'my test' } },
  };
}

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    example: 'my-example',
    test: 'my test',
    passed: true,
    duration: 42,
    ...overrides,
  };
}

describe('TAP reporter', () => {
  it('emits valid TAP version header', async () => {
    const { version } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(makeResult(), false);
      r.finish({ passed: 1, failed: 0 });
    });
    expect(version).toBe(14);
  });

  it('emits correct plan matching example count', async () => {
    const { plan } = await collectTap((r) => {
      r.start([makeExample(), makeExample({ id: 'example2' })]);
      r.report(makeResult(), false);
      r.report(makeResult({ example: 'example2', test: 'test 2' }), false);
      r.finish({ passed: 2, failed: 0 });
    });
    expect(plan).toMatchObject({ start: 1, end: 2 });
  });

  it('emits ok for passing test', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(makeResult({ passed: true }), false);
      r.finish({ passed: 1, failed: 0 });
    });
    expect(asserts).toHaveLength(1);
    expect(asserts[0].ok).toBe(true);
  });

  it('emits not ok for failing test', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(makeResult({ passed: false, error: 'Expected exit code 0, got 1' }), false);
      r.finish({ passed: 0, failed: 1 });
    });
    expect(asserts).toHaveLength(1);
    expect(asserts[0].ok).toBe(false);
  });

  it('includes example > test name in assert description', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(makeResult({ example: 'my-example', test: 'runs correctly' }), false);
      r.finish({ passed: 1, failed: 0 });
    });
    expect(asserts[0].name).toContain('my-example');
    expect(asserts[0].name).toContain('runs correctly');
  });

  it('includes error message in YAML diagnostic block for failures', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(
        makeResult({
          passed: false,
          error: 'Expected exit code 0, got 1',
          actual: { exitCode: 1, stdout: '', stderr: '', interleaved: '' },
        }),
        false
      );
      r.finish({ passed: 0, failed: 1 });
    });
    expect(asserts[0].diag).toBeDefined();
    expect(String(asserts[0].diag?.message)).toContain('Expected exit code 0');
  });

  it('includes actual exit code in diagnostic block', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([makeExample()]);
      r.report(
        makeResult({
          passed: false,
          error: 'Expected exit code 0, got 2',
          actual: { exitCode: 2, stdout: 'some out', stderr: '', interleaved: 'some out' },
        }),
        false
      );
      r.finish({ passed: 0, failed: 1 });
    });
    expect(asserts[0].diag?.actual_exit_code).toBe(2);
  });

  it('assigns sequential test numbers', async () => {
    const { asserts } = await collectTap((r) => {
      r.start([
        makeExample({ id: 'a' }),
        makeExample({ id: 'b' }),
        makeExample({ id: 'c' }),
      ]);
      r.report(makeResult({ example: 'a', test: 't1' }), false);
      r.report(makeResult({ example: 'b', test: 't2' }), false);
      r.report(makeResult({ example: 'c', test: 't3' }), false);
      r.finish({ passed: 3, failed: 0 });
    });
    expect(asserts.map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it('produces parseable TAP for mixed pass/fail', async () => {
    const { asserts, summary } = await collectTap((r) => {
      r.start([makeExample({ id: 'a' }), makeExample({ id: 'b' })]);
      r.report(makeResult({ example: 'a', test: 'passes', passed: true }), false);
      r.report(
        makeResult({
          example: 'b',
          test: 'fails',
          passed: false,
          error: 'stdout missing',
        }),
        false
      );
      r.finish({ passed: 1, failed: 1 });
    });
    expect(asserts[0].ok).toBe(true);
    expect(asserts[1].ok).toBe(false);
    expect(summary?.pass).toBe(1);
    expect(summary?.fail).toBe(1);
  });
});
