import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createJavaScriptExtractor } from './extractor.js';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ExtractorOptions } from 'functional-examples';

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
      expect(file.absolutePath).toBe(path.join(tempDir, 'subdir/nested.ts'));
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
});
