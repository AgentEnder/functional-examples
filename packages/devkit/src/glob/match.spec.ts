import { describe, it, expect } from 'vitest';
import { isMatch, createMatcher } from './match.js';

describe('isMatch', () => {
  it('should match a simple glob pattern', async () => {
    expect(await isMatch('file.ts', '*.ts')).toBe(true);
    expect(await isMatch('file.js', '*.ts')).toBe(false);
  });

  it('should match with directory patterns', async () => {
    expect(await isMatch('src/file.ts', 'src/**/*.ts')).toBe(true);
    expect(await isMatch('lib/file.ts', 'src/**/*.ts')).toBe(false);
  });

  it('should accept an array of patterns', async () => {
    expect(await isMatch('file.ts', ['*.js', '*.ts'])).toBe(true);
    expect(await isMatch('file.css', ['*.js', '*.ts'])).toBe(false);
  });
});

describe('createMatcher', () => {
  it('should create a reusable matcher function', async () => {
    const matcher = await createMatcher('*.ts');
    expect(matcher('file.ts')).toBe(true);
    expect(matcher('file.js')).toBe(false);
  });

  it('should handle array of patterns', async () => {
    const matcher = await createMatcher(['*.ts', '*.js']);
    expect(matcher('file.ts')).toBe(true);
    expect(matcher('file.js')).toBe(true);
    expect(matcher('file.css')).toBe(false);
  });

  it('should handle complex glob patterns', async () => {
    const matcher = await createMatcher('**/{node_modules,.git}/**');
    expect(matcher('node_modules/foo/bar.js')).toBe(true);
    expect(matcher('.git/config')).toBe(true);
    expect(matcher('src/index.ts')).toBe(false);
  });
});
