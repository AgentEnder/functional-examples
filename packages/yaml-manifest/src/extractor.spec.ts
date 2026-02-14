import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createMetaYmlExtractor } from './extractor.js';
import type { ExtractorOptions } from '@functional-examples/devkit';

/**
 * Helper to recursively collect all Dirent entries from a directory tree.
 * This simulates what the scanner would provide to extractors.
 */
async function collectCandidates(dir: string): Promise<Dirent[]> {
  const candidates: Dirent[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      candidates.push(entry);
      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name));
      }
    }
  }

  await walk(dir);
  return candidates;
}

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

  const defaultOptions: ExtractorOptions = {
    rootPath: '',
  };

  function getOptions(): ExtractorOptions {
    return { ...defaultOptions, rootPath: testDir };
  }

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('my-example');
      expect(result.examples[0].title).toBe('Just Title');
    });

    it('ignores folders without meta.yml', async () => {
      const regularDir = path.join(testDir, 'regular');
      await mkdir(regularDir);

      await writeFile(path.join(regularDir, 'main.ts'), 'const x = 1;');

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
commands:
  - command: 'run main.ts'
    assertions:
      - contains: 'success'
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), '');

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      expect(result.examples[0].metadata).toMatchObject({
        id: 'complex',
        title: 'Complex Example',
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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

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
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('nested');
    });
  });

  describe('include glob patterns', () => {
    it('collects only files matching include patterns', async () => {
      const exampleDir = path.join(testDir, 'include-example');
      await mkdir(path.join(exampleDir, 'src'), { recursive: true });
      await mkdir(path.join(exampleDir, 'docs'), { recursive: true });

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: include-test
title: Include Test
include:
  - "src/**/*.ts"
  - "README.md"
`
      );
      await writeFile(path.join(exampleDir, 'src', 'main.ts'), 'main');
      await writeFile(path.join(exampleDir, 'src', 'helper.ts'), 'helper');
      await writeFile(path.join(exampleDir, 'docs', 'guide.md'), 'guide');
      await writeFile(path.join(exampleDir, 'README.md'), 'readme');
      await writeFile(path.join(exampleDir, 'ignored.js'), 'ignored');

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      expect(result.examples).toHaveLength(1);
      const paths = result.examples[0].files
        .map((f) => f.relativePath)
        .sort();
      // Should include src/*.ts and README.md, but NOT docs/guide.md or ignored.js
      expect(paths).toEqual(['README.md', 'src/helper.ts', 'src/main.ts']);
    });

    it('strips include from metadata', async () => {
      const exampleDir = path.join(testDir, 'include-strip');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: strip-test
title: Strip Test
include:
  - "*.ts"
custom: value
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      expect(result.examples[0].metadata).not.toHaveProperty('include');
      expect(result.examples[0].metadata).toHaveProperty('custom', 'value');
    });

    it('falls back to full directory walk when include is absent', async () => {
      const exampleDir = path.join(testDir, 'no-include');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: no-include
title: No Include
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');
      await writeFile(path.join(exampleDir, 'helper.js'), 'helper');

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      const paths = result.examples[0].files
        .map((f) => f.relativePath)
        .sort();
      expect(paths).toEqual(['helper.js', 'main.ts']);
    });

    it('respects excludePatterns with include', async () => {
      const exampleDir = path.join(testDir, 'include-exclude');
      await mkdir(path.join(exampleDir, 'src'), { recursive: true });
      await mkdir(path.join(exampleDir, 'node_modules'), { recursive: true });

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: include-exclude
title: Include Exclude
include:
  - "**/*.ts"
`
      );
      await writeFile(path.join(exampleDir, 'src', 'main.ts'), 'main');
      await writeFile(
        path.join(exampleDir, 'node_modules', 'dep.ts'),
        'dep'
      );

      const extractor = createMetaYmlExtractor();
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      const paths = result.examples[0].files
        .map((f) => f.relativePath)
        .sort();
      // node_modules should be excluded by default excludePatterns
      expect(paths).toEqual(['src/main.ts']);
    });

    it('respects excludeFiles with include', async () => {
      const exampleDir = path.join(testDir, 'include-excludefiles');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: include-ef
title: Include EF
include:
  - "*.ts"
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'main');
      await writeFile(path.join(exampleDir, 'secret.ts'), 'secret');

      const extractor = createMetaYmlExtractor({
        excludeFiles: ['secret.ts'],
      });
      const candidates = await collectCandidates(testDir);
      const result = await extractor.extract(candidates, getOptions());

      const paths = result.examples[0].files.map((f) => f.relativePath);
      expect(paths).toEqual(['main.ts']);
    });
  });

  describe('file candidates', () => {
    it('handles file candidates (meta.yml passed directly)', async () => {
      const exampleDir = path.join(testDir, 'file-candidate');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: from-file
title: From File Candidate
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor();
      // Only pass the meta.yml file as a candidate
      const entries = await readdir(exampleDir, { withFileTypes: true });
      const metaFile = entries.find((e) => e.name === 'meta.yml');
      if (!metaFile) {
        throw new Error('meta.yml not found in test directory');
      }

      const result = await extractor.extract([metaFile], getOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('from-file');
      expect(result.examples[0].title).toBe('From File Candidate');
    });

    it('handles directory candidates', async () => {
      const exampleDir = path.join(testDir, 'dir-candidate');
      await mkdir(exampleDir);

      await writeFile(
        path.join(exampleDir, 'meta.yml'),
        `id: from-dir
title: From Directory Candidate
`
      );
      await writeFile(path.join(exampleDir, 'main.ts'), 'code');

      const extractor = createMetaYmlExtractor();
      // Only pass the directory as a candidate
      const entries = await readdir(testDir, { withFileTypes: true });
      const dirEntry = entries.find((e) => e.name === 'dir-candidate');
      if (!dirEntry) {
        throw new Error('dir-candidate directory not found in test directory');
      }

      const result = await extractor.extract([dirEntry], getOptions());

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('from-dir');
    });
  });
});
