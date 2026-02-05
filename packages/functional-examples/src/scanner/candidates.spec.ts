import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveCandidates, getDefaultIncludePattern } from './candidates.js';

describe('resolveCandidates', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'candidates-test-'));
    // Create test structure
    await fs.mkdir(path.join(tempDir, 'example-a'));
    await fs.mkdir(path.join(tempDir, 'example-b'));
    await fs.writeFile(path.join(tempDir, 'single-file.ts'), '// test');
    await fs.mkdir(path.join(tempDir, 'node_modules'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return immediate children with default * pattern', async () => {
    const candidates = await resolveCandidates(tempDir, ['*'], []);
    const names = candidates.map((c) => c.name).sort();
    expect(names).toContain('example-a');
    expect(names).toContain('example-b');
    expect(names).toContain('single-file.ts');
    expect(names).toContain('node_modules');
  });

  it('should filter by exclude patterns', async () => {
    const candidates = await resolveCandidates(tempDir, ['*'], ['node_modules']);
    const names = candidates.map((c) => c.name);
    expect(names).not.toContain('node_modules');
  });

  it('should handle nested patterns like examples/*', async () => {
    await fs.mkdir(path.join(tempDir, 'examples'));
    await fs.mkdir(path.join(tempDir, 'examples', 'nested-a'));
    await fs.mkdir(path.join(tempDir, 'examples', 'nested-b'));

    const candidates = await resolveCandidates(tempDir, ['examples/*'], []);
    const names = candidates.map((c) => c.name).sort();
    expect(names).toEqual(['nested-a', 'nested-b']);
  });

  it('should return Dirent objects with correct types', async () => {
    const candidates = await resolveCandidates(tempDir, ['*'], []);

    const fileCandidate = candidates.find((c) => c.name === 'single-file.ts');
    const dirCandidate = candidates.find((c) => c.name === 'example-a');

    expect(fileCandidate?.isFile()).toBe(true);
    expect(dirCandidate?.isDirectory()).toBe(true);
  });
});

describe('getDefaultIncludePattern', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'default-pattern-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return ["*"] when no examples directory exists', async () => {
    await fs.mkdir(path.join(tempDir, 'src'));
    const pattern = await getDefaultIncludePattern(tempDir);
    expect(pattern).toEqual(['*']);
  });

  it('should return ["examples/*"] when examples directory exists', async () => {
    await fs.mkdir(path.join(tempDir, 'examples'));
    const pattern = await getDefaultIncludePattern(tempDir);
    expect(pattern).toEqual(['examples/*']);
  });
});
