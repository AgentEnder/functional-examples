import { describe, it, expect } from 'vitest';
import { glob } from './glob.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';

describe('glob', () => {
  let tmpDir: string;

  async function setup(files: string[]) {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-test-'));
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, '');
    }
  }

  it('should match files with a single pattern', async () => {
    await setup(['a.ts', 'b.ts', 'c.js']);
    const result = await glob('*.ts', { cwd: tmpDir });
    expect(result.sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('should accept a string pattern (not just array)', async () => {
    await setup(['file.txt']);
    const result = await glob('*.txt', { cwd: tmpDir });
    expect(result).toEqual(['file.txt']);
  });

  it('should accept an array of patterns', async () => {
    await setup(['a.ts', 'b.js', 'c.css']);
    const result = await glob(['*.ts', '*.js'], { cwd: tmpDir });
    expect(result.sort()).toEqual(['a.ts', 'b.js']);
  });

  it('should respect ignore option', async () => {
    await setup(['src/a.ts', 'dist/b.ts']);
    const result = await glob('**/*.ts', {
      cwd: tmpDir,
      ignore: ['dist/**'],
    });
    expect(result).toEqual(['src/a.ts']);
  });

  it('should return absolute paths when requested', async () => {
    await setup(['file.ts']);
    const result = await glob('*.ts', { cwd: tmpDir, absolute: true });
    expect(result.length).toBe(1);
    expect(path.isAbsolute(result[0])).toBe(true);
  });

  it('should return empty array when nothing matches', async () => {
    await setup(['file.ts']);
    const result = await glob('*.css', { cwd: tmpDir });
    expect(result).toEqual([]);
  });
});
