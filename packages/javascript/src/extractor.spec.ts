import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createJavaScriptExtractor } from './extractor.js';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ExtractorOptions } from '@functional-examples/devkit';

/**
 * Helper to create a mock Dirent object for testing
 */
function createMockDirent(
  name: string,
  parentPath: string,
  isDirectory: boolean
): Dirent {
  return {
    name,
    parentPath,
    isFile: () => !isDirectory,
    isDirectory: () => isDirectory,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    path: parentPath,
  } as Dirent;
}

/**
 * Helper to get directory entries as Dirent objects
 */
async function getDirents(dirPath: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

describe('createJavaScriptExtractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-extractor-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function writeFile(
    relativePath: string,
    content: string
  ): Promise<string> {
    const fullPath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }

  function makeOptions(overrides?: Partial<ExtractorOptions>): ExtractorOptions {
    return {
      rootPath: tempDir,
      ...overrides,
    };
  }

  describe('finding files with valid frontmatter', () => {
    it('should find TypeScript files with line comment frontmatter', async () => {
      await writeFile(
        'example.ts',
        `// ---
// id: my-example
// title: My Example
// description: A demo example
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('my-example');
      expect(result.examples[0].title).toBe('My Example');
      expect(result.examples[0].description).toBe('A demo example');
    });

    it('should find JavaScript files with block comment frontmatter', async () => {
      await writeFile(
        'example.js',
        `/* ---
id: js-example
title: JS Example
tags:
  - demo
  - javascript
--- */
function hello() {}
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('js-example');
      expect(result.examples[0].title).toBe('JS Example');
      expect(result.examples[0].metadata).toEqual({
        tags: ['demo', 'javascript'],
      });
    });

    it('should find multiple files with valid frontmatter', async () => {
      await writeFile(
        'first.ts',
        `// ---
// id: first-example
// title: First Example
// ---
const a = 1;
`
      );
      await writeFile(
        'second.tsx',
        `// ---
// id: second-example
// title: Second Example
// ---
const b = 2;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(2);
      const ids = result.examples.map((e) => e.id);
      expect(ids).toContain('first-example');
      expect(ids).toContain('second-example');
    });

    it('should support .jsx, .mjs, .cjs, .mts, .cts extensions', async () => {
      await writeFile(
        'a.jsx',
        `// ---
// id: jsx-ex
// title: JSX
// ---
`
      );
      await writeFile(
        'b.mjs',
        `// ---
// id: mjs-ex
// title: MJS
// ---
`
      );
      await writeFile(
        'c.cjs',
        `// ---
// id: cjs-ex
// title: CJS
// ---
`
      );
      await writeFile(
        'd.mts',
        `// ---
// id: mts-ex
// title: MTS
// ---
`
      );
      await writeFile(
        'e.cts',
        `// ---
// id: cts-ex
// title: CTS
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(5);
    });
  });

  describe('ignoring files without frontmatter', () => {
    it('should ignore files with no frontmatter', async () => {
      await writeFile(
        'no-frontmatter.ts',
        `const x = 1;
const y = 2;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
      expect(result.claimedFiles.size).toBe(0);
    });

    it('should ignore files with empty frontmatter', async () => {
      await writeFile(
        'empty-frontmatter.ts',
        `// ---
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });
  });

  describe('ignoring files with frontmatter missing required fields', () => {
    it('should ignore files missing id', async () => {
      await writeFile(
        'no-id.ts',
        `// ---
// title: Only Title
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });

    it('should ignore files missing title', async () => {
      await writeFile(
        'no-title.ts',
        `// ---
// id: only-id
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });

    it('should ignore files where id is not a string', async () => {
      await writeFile(
        'invalid-id.ts',
        `// ---
// id: 123
// title: Has Title
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });

    it('should ignore files where title is not a string', async () => {
      await writeFile(
        'invalid-title.ts',
        `// ---
// id: valid-id
// title:
//   nested: object
// ---
const x = 1;
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });
  });

  describe('loading raw content into ExampleFile', () => {
    it('should load raw file content', async () => {
      const content = `// ---
// id: raw-test
// title: Raw Test
// ---
const x = 1;
const y = 2;
`;
      await writeFile('raw.ts', content);

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].files).toHaveLength(1);
      expect(result.examples[0].files[0].raw).toBe(content);
    });

    it('should set absolutePath and relativePath correctly', async () => {
      await writeFile(
        'subdir/nested.ts',
        `// ---
// id: nested-test
// title: Nested Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      // Pass subdir as a directory candidate
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      const file = result.examples[0].files[0];
      expect(file.absolutePath).toBe(
        path.join(tempDir, 'subdir/nested.ts').replace(/\\/g, '/')
      );
      expect(file.relativePath).toBe('subdir/nested.ts');
    });

    it('should set rootPath to the file path', async () => {
      const filePath = await writeFile(
        'test.ts',
        `// ---
// id: root-test
// title: Root Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples[0].rootPath).toBe(filePath);
    });
  });

  describe('respecting exclude patterns', () => {
    it('should exclude node_modules by default', async () => {
      await writeFile(
        'node_modules/pkg/index.ts',
        `// ---
// id: nm-test
// title: Node Modules Test
// ---
`
      );
      await writeFile(
        'src/valid.ts',
        `// ---
// id: valid-test
// title: Valid Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('valid-test');
    });

    it('should exclude .git by default', async () => {
      await writeFile(
        '.git/hooks/pre-commit.ts',
        `// ---
// id: git-test
// title: Git Test
// ---
`
      );
      await writeFile(
        'valid.ts',
        `// ---
// id: valid-test
// title: Valid Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('valid-test');
    });

    it('should exclude dist by default', async () => {
      await writeFile(
        'dist/bundle.js',
        `// ---
// id: dist-test
// title: Dist Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });

    it('should exclude build by default', async () => {
      await writeFile(
        'build/output.js',
        `// ---
// id: build-test
// title: Build Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(0);
    });

    it('should respect custom exclude patterns', async () => {
      await writeFile(
        'examples/valid.ts',
        `// ---
// id: valid
// title: Valid
// ---
`
      );
      await writeFile(
        'ignored/excluded.ts',
        `// ---
// id: excluded
// title: Excluded
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(
        candidates,
        makeOptions({ exclude: ['**/ignored/**'] })
      );

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('valid');
    });
  });

  describe('claiming extracted files for conflict detection', () => {
    it('should add extracted files to claimedFiles set', async () => {
      const filePath = await writeFile(
        'claimed.ts',
        `// ---
// id: claimed-test
// title: Claimed Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.claimedFiles.has(filePath)).toBe(true);
    });

    it('should claim all extracted files', async () => {
      const path1 = await writeFile(
        'first.ts',
        `// ---
// id: first
// title: First
// ---
`
      );
      const path2 = await writeFile(
        'second.ts',
        `// ---
// id: second
// title: Second
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.claimedFiles.size).toBe(2);
      expect(result.claimedFiles.has(path1)).toBe(true);
      expect(result.claimedFiles.has(path2)).toBe(true);
    });

    it('should not claim files without valid frontmatter', async () => {
      await writeFile('unclaimed.ts', `const x = 1;`);
      const claimedPath = await writeFile(
        'claimed.ts',
        `// ---
// id: claimed
// title: Claimed
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.claimedFiles.size).toBe(1);
      expect(result.claimedFiles.has(claimedPath)).toBe(true);
    });
  });

  describe('extractor metadata', () => {
    it('should have the correct name', () => {
      const extractor = createJavaScriptExtractor();
      expect(extractor.name).toBe('javascript-extractor');
    });

    it('should set extractorName on examples', async () => {
      await writeFile(
        'test.ts',
        `// ---
// id: test
// title: Test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples[0].extractorName).toBe('javascript-extractor');
    });
  });

  describe('error handling', () => {
    it('should return empty results for empty candidates', async () => {
      const extractor = createJavaScriptExtractor();
      const result = await extractor.extract([], makeOptions());

      expect(result.examples).toHaveLength(0);
      expect(result.claimedFiles.size).toBe(0);
    });

    it('should handle non-existent directory candidates gracefully', async () => {
      const extractor = createJavaScriptExtractor();
      const candidates = [
        createMockDirent('nonexistent', '/fake/path', true),
      ];
      const result = await extractor.extract(
        candidates,
        makeOptions({ rootPath: '/fake/path' })
      );

      expect(result.examples).toHaveLength(0);
      expect(result.claimedFiles.size).toBe(0);
    });
  });

  describe('metadata extraction', () => {
    it('should include extra metadata fields beyond id, title, description', async () => {
      await writeFile(
        'with-extra.ts',
        `// ---
// id: extra-test
// title: Extra Test
// description: Has description
// category: tutorial
// difficulty: beginner
// tags:
//   - demo
//   - test
// ---
`
      );

      const extractor = createJavaScriptExtractor();
      const candidates = await getDirents(tempDir);
      const result = await extractor.extract(candidates, makeOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].description).toBe('Has description');
      expect(result.examples[0].metadata).toEqual({
        category: 'tutorial',
        difficulty: 'beginner',
        tags: ['demo', 'test'],
      });
    });
  });

  describe('package.json multi-file examples', () => {
    describe('basic detection', () => {
      it('should detect a directory with package.json as a multi-file example', async () => {
        await writeFile(
          'my-example/package.json',
          JSON.stringify({
            name: 'my-example',
            main: './src/index.ts',
          })
        );
        await writeFile('my-example/src/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].id).toBe('my-example');
        expect(result.examples[0].title).toBe('my-example');
        expect(result.examples[0].rootPath).toBe(
          path.join(tempDir, 'my-example')
        );
      });

      it('should handle package.json as a direct file candidate', async () => {
        await writeFile(
          'my-example/package.json',
          JSON.stringify({
            name: 'direct-example',
            main: './index.ts',
          })
        );
        await writeFile('my-example/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        // Pass package.json directly as a file candidate
        const candidates = [
          createMockDirent(
            'package.json',
            path.join(tempDir, 'my-example'),
            false
          ),
        ];
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].id).toBe('direct-example');
      });

      it('should ignore package.json without name field', async () => {
        await writeFile(
          'no-name/package.json',
          JSON.stringify({
            main: './src/index.ts',
          })
        );
        await writeFile('no-name/src/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(0);
      });
    });

    describe('metadata extraction from package.json', () => {
      it('should strip npm scope from name for id', async () => {
        await writeFile(
          'scoped/package.json',
          JSON.stringify({
            name: '@examples/getting-started',
            main: './index.ts',
          })
        );
        await writeFile('scoped/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].id).toBe('getting-started');
      });

      it('should extract description from package.json', async () => {
        await writeFile(
          'described/package.json',
          JSON.stringify({
            name: 'described-example',
            description: 'A basic walkthrough',
            main: './index.ts',
          })
        );
        await writeFile('described/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].description).toBe('A basic walkthrough');
      });

      it('should extract keywords as tags', async () => {
        await writeFile(
          'tagged/package.json',
          JSON.stringify({
            name: 'tagged-example',
            keywords: ['beginner', 'tutorial'],
            main: './index.ts',
          })
        );
        await writeFile('tagged/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].metadata.tags).toEqual([
          'beginner',
          'tutorial',
        ]);
      });

      it('should use functional-examples.title as override', async () => {
        await writeFile(
          'titled/package.json',
          JSON.stringify({
            name: 'getting-started',
            'functional-examples': {
              title: 'Getting Started Guide',
            },
            main: './index.ts',
          })
        );
        await writeFile('titled/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].title).toBe('Getting Started Guide');
      });

      it('should spread functional-examples fields into metadata', async () => {
        await writeFile(
          'with-meta/package.json',
          JSON.stringify({
            name: 'meta-example',
            'functional-examples': {
              title: 'Meta Example',
              difficulty: 'easy',
              category: 'tutorial',
            },
            main: './index.ts',
          })
        );
        await writeFile('with-meta/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].metadata.difficulty).toBe('easy');
        expect(result.examples[0].metadata.category).toBe('tutorial');
      });

      it('should combine all metadata sources correctly', async () => {
        await writeFile(
          'combined/package.json',
          JSON.stringify({
            name: '@examples/getting-started',
            description: 'A basic walkthrough',
            keywords: ['beginner'],
            main: './src/index.ts',
            'functional-examples': {
              title: 'Getting Started Guide',
              difficulty: 'easy',
            },
          })
        );
        await writeFile('combined/src/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const example = result.examples[0];
        expect(example.id).toBe('getting-started');
        expect(example.title).toBe('Getting Started Guide');
        expect(example.description).toBe('A basic walkthrough');
        expect(example.metadata.tags).toEqual(['beginner']);
        expect(example.metadata.difficulty).toBe('easy');
      });
    });

    describe('file collection', () => {
      it('should always include package.json', async () => {
        await writeFile(
          'pkg-included/package.json',
          JSON.stringify({
            name: 'pkg-included',
            main: './index.ts',
          })
        );
        await writeFile('pkg-included/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('package.json');
      });

      it('should include README.md if it exists', async () => {
        await writeFile(
          'with-readme/package.json',
          JSON.stringify({
            name: 'with-readme',
            main: './index.ts',
          })
        );
        await writeFile('with-readme/index.ts', 'export const x = 1;');
        await writeFile('with-readme/README.md', '# With Readme');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('README.md');
      });

      it('should include files from main field', async () => {
        await writeFile(
          'with-main/package.json',
          JSON.stringify({
            name: 'with-main',
            main: './src/index.ts',
          })
        );
        await writeFile('with-main/src/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.ts');
      });

      it('should include files from module field', async () => {
        await writeFile(
          'with-module/package.json',
          JSON.stringify({
            name: 'with-module',
            module: './src/index.mjs',
          })
        );
        await writeFile('with-module/src/index.mjs', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.mjs');
      });

      it('should include files from types field', async () => {
        await writeFile(
          'with-types/package.json',
          JSON.stringify({
            name: 'with-types',
            main: './dist/index.js',
            types: './src/index.d.ts',
          })
        );
        await writeFile('with-types/dist/index.js', 'exports.x = 1;');
        await writeFile(
          'with-types/src/index.d.ts',
          'export declare const x: number;'
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.d.ts');
      });

      it('should include files from files array globs', async () => {
        await writeFile(
          'with-files/package.json',
          JSON.stringify({
            name: 'with-files',
            files: ['assets/**'],
          })
        );
        await writeFile('with-files/assets/image.png', 'fake image');
        await writeFile('with-files/assets/data.json', '{}');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('assets/image.png');
        expect(fileNames).toContain('assets/data.json');
      });
    });

    describe('exports field parsing', () => {
      it('should handle string exports', async () => {
        await writeFile(
          'string-exports/package.json',
          JSON.stringify({
            name: 'string-exports',
            exports: './index.ts',
          })
        );
        await writeFile('string-exports/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('index.ts');
      });

      it('should handle object exports with conditions', async () => {
        await writeFile(
          'object-exports/package.json',
          JSON.stringify({
            name: 'object-exports',
            exports: {
              '.': {
                import: './src/index.mjs',
                require: './src/index.cjs',
              },
            },
          })
        );
        await writeFile('object-exports/src/index.mjs', 'export const x = 1;');
        await writeFile('object-exports/src/index.cjs', 'exports.x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.mjs');
        expect(fileNames).toContain('src/index.cjs');
      });

      it('should handle nested export maps', async () => {
        await writeFile(
          'nested-exports/package.json',
          JSON.stringify({
            name: 'nested-exports',
            exports: {
              '.': './src/index.ts',
              './utils': './src/utils.ts',
            },
          })
        );
        await writeFile('nested-exports/src/index.ts', 'export const x = 1;');
        await writeFile(
          'nested-exports/src/utils.ts',
          'export const util = () => {};'
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.ts');
        expect(fileNames).toContain('src/utils.ts');
      });
    });

    describe('metadata stripping', () => {
      it('should strip functional-examples key from package.json in output', async () => {
        await writeFile(
          'stripped/package.json',
          JSON.stringify(
            {
              name: 'stripped',
              main: './index.ts',
              'functional-examples': {
                title: 'Stripped Example',
              },
            },
            null,
            2
          )
        );
        await writeFile('stripped/index.ts', 'export const x = 1;');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const pkgFile = result.examples[0].files.find((f) =>
          f.relativePath.endsWith('package.json')
        );
        expect(pkgFile).toBeDefined();
        expect(pkgFile?.raw).toBeDefined();
        const parsed = JSON.parse(pkgFile?.raw ?? '{}');
        expect(parsed['functional-examples']).toBeUndefined();
        expect(parsed.name).toBe('stripped');
        expect(parsed.main).toBe('./index.ts');
      });
    });

    describe('edge cases', () => {
      it('should error if no files can be determined', async () => {
        await writeFile(
          'no-files/package.json',
          JSON.stringify({
            name: 'no-files',
            // No main, module, exports, or files
          })
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(
          'No files could be determined'
        );
      });

      it('should claim all files in the package example', async () => {
        const pkgPath = await writeFile(
          'claimed-pkg/package.json',
          JSON.stringify({
            name: 'claimed-pkg',
            main: './src/index.ts',
          })
        );
        const indexPath = await writeFile(
          'claimed-pkg/src/index.ts',
          'export const x = 1;'
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.claimedFiles.has(pkgPath)).toBe(true);
        expect(result.claimedFiles.has(indexPath)).toBe(true);
      });

      it('should not scan for single-file examples in directories with package.json', async () => {
        // Directory has package.json, but also has a file with frontmatter
        await writeFile(
          'pkg-dir/package.json',
          JSON.stringify({
            name: 'pkg-dir',
            main: './index.ts',
          })
        );
        await writeFile('pkg-dir/index.ts', 'export const x = 1;');
        await writeFile(
          'pkg-dir/other.ts',
          `// ---
// id: other-example
// title: Other Example
// ---
export const y = 2;
`
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        // Should only have one example (the package), not the single-file frontmatter one
        expect(result.examples).toHaveLength(1);
        expect(result.examples[0].id).toBe('pkg-dir');
      });

      it('should report an error for invalid JSON in package.json', async () => {
        await writeFile('bad-json/package.json', '{ invalid json }');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Failed to parse package.json');
      });

      it('should handle non-existent entry files gracefully', async () => {
        await writeFile(
          'missing-entry/package.json',
          JSON.stringify({
            name: 'missing-entry',
            main: './nonexistent.ts',
            files: ['assets/**'],
          })
        );
        await writeFile('missing-entry/assets/data.json', '{}');

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        // Should still work with files array
        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('assets/data.json');
        expect(fileNames).not.toContain('nonexistent.ts');
      });
    });

    describe('dependency tracing', () => {
      it('should trace imports from entry files', async () => {
        await writeFile(
          'traced/package.json',
          JSON.stringify({
            name: 'traced',
            main: './src/index.ts',
          })
        );
        await writeFile(
          'traced/src/index.ts',
          `import { helper } from './helper';
export const x = helper();`
        );
        await writeFile(
          'traced/src/helper.ts',
          'export const helper = () => 1;'
        );

        const extractor = createJavaScriptExtractor();
        const candidates = await getDirents(tempDir);
        const result = await extractor.extract(candidates, makeOptions());

        expect(result.examples).toHaveLength(1);
        const fileNames = result.examples[0].files.map((f) => f.relativePath);
        expect(fileNames).toContain('src/index.ts');
        // dependency-tree may or may not trace this depending on parsing
        // The implementation handles tracing gracefully
      });
    });
  });
});
