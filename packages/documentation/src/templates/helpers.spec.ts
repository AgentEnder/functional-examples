import { describe, it, expect } from 'vitest';
import { ExampleFile } from '@functional-examples/devkit';
import {
  langFromPath,
  region,
  filesByExt,
  isProseFile,
  hunkDescription,
  slugify,
} from './helpers.js';

describe('langFromPath', () => {
  it('should return typescript for .ts files', () => {
    expect(langFromPath('src/index.ts')).toBe('typescript');
  });

  it('should return javascript for .js files', () => {
    expect(langFromPath('lib/main.js')).toBe('javascript');
  });

  it('should return tsx for .tsx files', () => {
    expect(langFromPath('App.tsx')).toBe('tsx');
  });

  it('should return json for .json files', () => {
    expect(langFromPath('package.json')).toBe('json');
  });

  it('should return yaml for .yml files', () => {
    expect(langFromPath('config.yml')).toBe('yaml');
  });

  it('should return the extension without dot for unknown extensions', () => {
    expect(langFromPath('file.rb')).toBe('rb');
  });

  it('should return empty string for files without extensions', () => {
    expect(langFromPath('Makefile')).toBe('');
  });

  it('should be case-insensitive', () => {
    expect(langFromPath('file.TS')).toBe('typescript');
  });
});

describe('region', () => {
  const files: ExampleFile[] = [
    new ExampleFile({
      absolutePath: '/a.ts',
      relativePath: 'a.ts',
      hunks: [
        { id: 'setup', content: 'const x = 1;', startLine: 1, endLine: 3 },
        { id: 'main', content: 'console.log(x);', startLine: 5, endLine: 7 },
      ],
    }),
    new ExampleFile({
      absolutePath: '/b.ts',
      relativePath: 'b.ts',
      hunks: [
        { id: 'helper', content: 'function f() {}', startLine: 1, endLine: 3 },
      ],
    }),
  ];

  it('should find a region by id', () => {
    const result = region(files, 'main');
    expect(result).toBeDefined();
    expect(result?.content).toBe('console.log(x);');
    expect(result?.file.relativePath).toBe('a.ts');
  });

  it('should find a region in a different file', () => {
    const result = region(files, 'helper');
    expect(result).toBeDefined();
    expect(result?.content).toBe('function f() {}');
  });

  it('should return undefined for non-existent region', () => {
    expect(region(files, 'nonexistent')).toBeUndefined();
  });

  it('should handle files without hunks', () => {
    const noHunks: ExampleFile[] = [
      new ExampleFile({ absolutePath: '/c.ts', relativePath: 'c.ts' }),
    ];
    expect(region(noHunks, 'any')).toBeUndefined();
  });
});

describe('filesByExt', () => {
  const files: ExampleFile[] = [
    new ExampleFile({ absolutePath: '/a.ts', relativePath: 'a.ts' }),
    new ExampleFile({ absolutePath: '/b.js', relativePath: 'b.js' }),
    new ExampleFile({ absolutePath: '/c.ts', relativePath: 'c.ts' }),
    new ExampleFile({ absolutePath: '/d.json', relativePath: 'd.json' }),
  ];

  it('should filter files by extension with dot', () => {
    const result = filesByExt(files, '.ts');
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.relativePath)).toEqual(['a.ts', 'c.ts']);
  });

  it('should filter files by extension without dot', () => {
    const result = filesByExt(files, 'js');
    expect(result).toHaveLength(1);
    expect(result[0].relativePath).toBe('b.js');
  });

  it('should return empty array for no matches', () => {
    expect(filesByExt(files, '.py')).toHaveLength(0);
  });
});

describe('isProseFile', () => {
  it('should return true for .md files', () => {
    expect(
      isProseFile(new ExampleFile({ absolutePath: '/README.md', relativePath: 'README.md' }))
    ).toBe(true);
  });

  it('should return true for .mdx files', () => {
    expect(
      isProseFile(new ExampleFile({ absolutePath: '/doc.mdx', relativePath: 'doc.mdx' }))
    ).toBe(true);
  });

  it('should return false for .ts files', () => {
    expect(
      isProseFile(new ExampleFile({ absolutePath: '/index.ts', relativePath: 'index.ts' }))
    ).toBe(false);
  });

  it('should return false for files without extensions', () => {
    expect(
      isProseFile(new ExampleFile({ absolutePath: '/Makefile', relativePath: 'Makefile' }))
    ).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(
      isProseFile(new ExampleFile({ absolutePath: '/DOC.MD', relativePath: 'DOC.MD' }))
    ).toBe(true);
  });
});

describe('hunkDescription', () => {
  it('should return description for a known hunk ID', () => {
    const metadata = {
      docs: {
        hunks: { setup: 'Initializes config', main: 'Main logic' },
      },
    };
    expect(hunkDescription(metadata, 'setup')).toBe('Initializes config');
    expect(hunkDescription(metadata, 'main')).toBe('Main logic');
  });

  it('should return undefined for unknown hunk ID', () => {
    const metadata = {
      docs: { hunks: { setup: 'Initializes config' } },
    };
    expect(hunkDescription(metadata, 'unknown')).toBeUndefined();
  });

  it('should return undefined when docs is not present', () => {
    expect(hunkDescription({}, 'setup')).toBeUndefined();
  });

  it('should return undefined when hunks is not present', () => {
    expect(hunkDescription({ docs: {} }, 'setup')).toBeUndefined();
  });
});

describe('slugify', () => {
  it('should lowercase and replace non-alphanumeric chars with dashes', () => {
    expect(slugify('Getting Started')).toBe('getting-started');
  });

  it('should strip backticks', () => {
    expect(slugify('`src/index.ts`')).toBe('src-index-ts');
  });

  it('should trim leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('should collapse multiple non-alphanumeric chars', () => {
    expect(slugify('foo   bar---baz')).toBe('foo-bar-baz');
  });
});
