import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMetaYmlExtractor } from './extractor.js';

describe('createMetaYmlExtractor', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `meta-yml-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic extraction', () => {
    it('extracts metadata from folder with meta.yml', async () => {
      const exampleDir = path.join(testDir, 'basic-example');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: basic-example
title: Basic Example
description: A simple multi-file example
`
      );

      await writeFile(
        path.join(exampleDir, 'main.ts'),
        "console.log('Hello!');"
      );

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('basic-example');
      expect(result.examples[0].title).toBe('Basic Example');
      expect(result.examples[0].description).toBe(
        'A simple multi-file example'
      );
      expect(result.examples[0].files).toHaveLength(1);
      expect(result.examples[0].files[0].relativePath).toBe('main.ts');
      expect(result.errors).toHaveLength(0);
    });

    it('uses folder name as id when not specified', async () => {
      const exampleDir = path.join(testDir, 'my-example');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `title: Just Title
`
      );

      await writeFile(path.join(exampleDir, 'index.ts'), 'export {};');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('my-example');
      expect(result.examples[0].title).toBe('Just Title');
    });

    it('ignores folders without meta.yml', async () => {
      const regularDir = path.join(testDir, 'regular');
      await mkdir(regularDir);

      await writeFile(path.join(regularDir, 'main.ts'), 'const x = 1;');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles multiple examples', async () => {
      const example1 = path.join(testDir, 'ex1');
      const example2 = path.join(testDir, 'ex2');
      await mkdir(example1);
      await mkdir(example2);

      await writeFile(
        path.join(example1, 'meta.yml'),
        `id: ex1
title: Example 1
`
      );
      await writeFile(path.join(example1, 'main.ts'), '');

      await writeFile(
        path.join(example2, 'meta.yml'),
        `id: ex2
title: Example 2
`
      );
      await writeFile(path.join(example2, 'main.ts'), '');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(2);
      const ids = result.examples.map((e) => e.id).sort();
      expect(ids).toEqual(['ex1', 'ex2']);
    });
  });

  describe('file collection', () => {
    it('collects all files in the example folder', async () => {
      const exampleDir = path.join(testDir, 'multi-file');
      await mkdir(exampleDir);

      await writeFile(path.join(exampleDir, 'meta.yml'), `title: Multi\n`);
      await writeFile(path.join(exampleDir, 'main.ts'), 'main');
      await writeFile(path.join(exampleDir, 'helper.ts'), 'helper');
      await writeFile(path.join(exampleDir, 'config.json'), '{}');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples[0].files).toHaveLength(3);
      const paths = result.examples[0].files.map((f) => f.relativePath).sort();
      expect(paths).toEqual(['config.json', 'helper.ts', 'main.ts']);
    });

    it('collects files from nested directories', async () => {
      const exampleDir = path.join(testDir, 'nested');
      await mkdir(path.join(exampleDir, 'src'), { recursive: true });

      await writeFile(path.join(exampleDir, 'meta.yml'), `title: Nested\n`);
      await writeFile(path.join(exampleDir, 'index.ts'), 'index');
      await writeFile(path.join(exampleDir, 'src', 'helper.ts'), 'helper');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples[0].files).toHaveLength(2);
      const paths = result.examples[0].files.map((f) => f.relativePath).sort();
      expect(paths).toEqual(['index.ts', 'src/helper.ts']);
    });

    it('excludes meta.yml from files list', async () => {
      const exampleDir = path.join(testDir, 'exclude-meta');
      await mkdir(exampleDir);

      await writeFile(path.join(exampleDir, 'meta.yml'), `title: Test\n`);
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      const paths = result.examples[0].files.map((f) => f.relativePath);
      expect(paths).not.toContain('meta.yml');
    });

    it('excludes specified files', async () => {
      const exampleDir = path.join(testDir, 'exclude-files');
      await mkdir(exampleDir);

      await writeFile(path.join(exampleDir, 'meta.yml'), `title: Test\n`);
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');
      await writeFile(path.join(exampleDir, 'content.md'), 'docs');

      const extractor = createMetaYmlExtractor({
        excludeFiles: ['content.md'],
      });
      const result = await extractor.extract(testDir);

      const paths = result.examples[0].files.map((f) => f.relativePath);
      expect(paths).toEqual(['main.ts']);
    });
  });

  describe('custom meta file name', () => {
    it('supports custom meta file name', async () => {
      const exampleDir = path.join(testDir, 'custom-meta');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'example.yaml'),
        `id: custom
title: Custom Meta
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor({
        metaFileName: 'example.yaml',
      });
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('custom');
    });
  });

  describe('claimed files', () => {
    it('claims meta.yml and all collected files', async () => {
      const exampleDir = path.join(testDir, 'claimed');
      await mkdir(exampleDir);

      await writeFile(path.join(exampleDir, 'meta.yml'), `title: Test\n`);
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');
      await writeFile(path.join(exampleDir, 'helper.ts'), 'helper');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      // Should claim: meta.yml + main.ts + helper.ts = 3 files
      expect(result.claimedFiles.size).toBe(3);
      expect(result.claimedFiles.has(path.join(exampleDir, 'meta.yml'))).toBe(
        true
      );
      expect(result.claimedFiles.has(path.join(exampleDir, 'main.ts'))).toBe(
        true
      );
      expect(result.claimedFiles.has(path.join(exampleDir, 'helper.ts'))).toBe(
        true
      );
    });
  });

  describe('metadata extraction', () => {
    it('extracts complex metadata', async () => {
      const exampleDir = path.join(testDir, 'complex');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: complex
title: Complex Example
entryPoint: main.ts
commands:
  - command: 'run main.ts'
    assertions:
      - contains: 'success'
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), '');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples[0].metadata).toMatchObject({
        id: 'complex',
        title: 'Complex Example',
        entryPoint: 'main.ts',
        commands: [
          {
            command: 'run main.ts',
            assertions: [{ contains: 'success' }],
          },
        ],
      });
    });
  });

  describe('error handling', () => {
    it('collects errors for malformed YAML', async () => {
      const exampleDir = path.join(testDir, 'bad-yaml');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: bad
malformed: [unclosed
`
      );

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toContain('meta.yml');
    });
  });

  describe('nested examples', () => {
    it('finds examples in nested directories', async () => {
      const nestedDir = path.join(testDir, 'category', 'subcategory');
      await mkdir(nestedDir, { recursive: true });

      await writeFile(
        path.join(nestedDir, 'meta.yml'),
        `id: nested
title: Nested Example
`
      );
      await writeFile(path.join(nestedDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor();
      const result = await extractor.extract(testDir);

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('nested');
    });
  });
});
