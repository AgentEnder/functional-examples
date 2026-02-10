import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Dirent } from 'node:fs';
import { createMarkdownExtractor } from './extractor.js';

function makeDirent(name: string, parentPath: string, isFile = true): Dirent {
  return {
    name,
    parentPath,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
  } as Dirent;
}

describe('createMarkdownExtractor', () => {
  let tmpDir: string;
  const extractor = createMarkdownExtractor();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-ext-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should have the correct name', () => {
    expect(extractor.name).toBe('markdown-frontmatter-extractor');
  });

  it('should extract a markdown file with valid frontmatter', async () => {
    const content = `---
id: my-guide
title: Getting Started Guide
description: A guide to getting started
tags:
  - beginner
---

# Getting Started

This is the guide body.
`;
    await fs.writeFile(path.join(tmpDir, 'guide.md'), content, 'utf-8');

    const candidates = [makeDirent('guide.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.errors).toHaveLength(0);
    expect(result.examples).toHaveLength(1);

    const example = result.examples[0];
    expect(example.id).toBe('my-guide');
    expect(example.title).toBe('Getting Started Guide');
    expect(example.description).toBe('A guide to getting started');
    expect(example.extractorName).toBe('markdown-frontmatter-extractor');
    expect(example.files).toHaveLength(1);
    expect(example.files[0].relativePath).toBe('guide.md');
    expect(example.files[0].raw).toBe(content);
    expect(example.files[0].parsed).toBe(
      '# Getting Started\n\nThis is the guide body.\n'
    );
  });

  it('should claim extracted files', async () => {
    const content = `---
id: claimed
title: Claimed File
---

Body.
`;
    await fs.writeFile(path.join(tmpDir, 'claimed.md'), content, 'utf-8');

    const candidates = [makeDirent('claimed.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.claimedFiles.size).toBe(1);
    expect(result.claimedFiles.has(path.join(tmpDir, 'claimed.md'))).toBe(true);
  });

  it('should skip files without frontmatter', async () => {
    const content = '# Just a regular markdown file\n\nNo frontmatter here.\n';
    await fs.writeFile(path.join(tmpDir, 'no-fm.md'), content, 'utf-8');

    const candidates = [makeDirent('no-fm.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
    expect(result.claimedFiles.size).toBe(0);
  });

  it('should skip files missing required id field', async () => {
    const content = `---
title: No ID
---

Body.
`;
    await fs.writeFile(path.join(tmpDir, 'no-id.md'), content, 'utf-8');

    const candidates = [makeDirent('no-id.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
  });

  it('should skip files missing required title field', async () => {
    const content = `---
id: no-title
---

Body.
`;
    await fs.writeFile(path.join(tmpDir, 'no-title.md'), content, 'utf-8');

    const candidates = [makeDirent('no-title.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
  });

  it('should skip non-.md files', async () => {
    const content = `---
id: text-file
title: Text File
---

Body.
`;
    await fs.writeFile(path.join(tmpDir, 'file.txt'), content, 'utf-8');

    const candidates = [makeDirent('file.txt', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
  });

  it('should skip directory candidates', async () => {
    const candidates = [makeDirent('some-dir', tmpDir, false)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
  });

  it('should handle multiple candidates', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'a.md'),
      '---\nid: a\ntitle: A\n---\nBody A.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tmpDir, 'b.md'),
      '---\nid: b\ntitle: B\n---\nBody B.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tmpDir, 'c.md'),
      '# No frontmatter\n',
      'utf-8'
    );

    const candidates = [
      makeDirent('a.md', tmpDir),
      makeDirent('b.md', tmpDir),
      makeDirent('c.md', tmpDir),
    ];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(2);
    expect(result.examples.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(result.claimedFiles.size).toBe(2);
  });

  it('should report errors for unreadable files', async () => {
    // Create a candidate pointing to a non-existent file
    const candidates = [makeDirent('missing.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe(path.join(tmpDir, 'missing.md'));
  });

  it('should skip files with unterminated frontmatter', async () => {
    const content = '---\nid: broken\ntitle: Broken\n\nNo closing fence.\n';
    await fs.writeFile(path.join(tmpDir, 'broken.md'), content, 'utf-8');

    const candidates = [makeDirent('broken.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(0);
  });

  it('should preserve extra metadata fields', async () => {
    const content = `---
id: extra
title: Extra Fields
tags:
  - tutorial
  - beginner
category: guides
---

Content.
`;
    await fs.writeFile(path.join(tmpDir, 'extra.md'), content, 'utf-8');

    const candidates = [makeDirent('extra.md', tmpDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(1);
    const meta = result.examples[0].metadata as Record<string, unknown>;
    expect(meta.tags).toEqual(['tutorial', 'beginner']);
    expect(meta.category).toBe('guides');
  });

  it('should set rootPath to the directory containing the file', async () => {
    const subDir = path.join(tmpDir, 'nested');
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(
      path.join(subDir, 'nested.md'),
      '---\nid: nested\ntitle: Nested\n---\nBody.\n',
      'utf-8'
    );

    const candidates = [makeDirent('nested.md', subDir)];
    const result = await extractor.extract(candidates, { rootPath: tmpDir });

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].rootPath).toBe(subDir);
  });
});
