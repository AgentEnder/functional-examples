import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Dirent } from 'node:fs';
import { scanExamples } from './scanner.js';
import type {
  Extractor,
  Example,
  ExtractorResult,
  ExtractorOptions,
  Plugin,
} from '../types/index.js';

/**
 * Create a mock extractor for testing
 */
function createMockExtractor(
  name: string,
  examples: Example[],
  claimedFiles: Set<string> = new Set()
): Extractor {
  return {
    name,
    async extract(_candidates: Dirent[], _options: ExtractorOptions) {
      return { examples, errors: [], claimedFiles };
    },
  };
}

/**
 * Create a mock extractor with custom result for testing
 */
function createMockExtractorWithResult<TMetadata = Record<string, unknown>>(
  name: string,
  result: Partial<ExtractorResult<TMetadata>>
): Extractor<TMetadata> {
  return {
    name,
    extract: vi.fn().mockResolvedValue({
      examples: [],
      errors: [],
      claimedFiles: new Set<string>(),
      ...result,
    }),
  };
}

/**
 * Create a mock example for testing
 */
function createMockExample(
  id: string,
  extractorName: string,
  files: string[]
): Example {
  return {
    id,
    title: `Example ${id}`,
    rootPath: `/test/${id}`,
    files: files.map((f) => ({
      absolutePath: f,
      relativePath: f.split('/').pop() ?? f,
    })),
    metadata: {},
    extractorName,
  };
}

describe('scanExamples', () => {
  describe('basic operation', () => {
    it('returns empty result when no extractors provided', async () => {
      const result = await scanExamples({
        root: '/test',
        extractors: [],
      });

      expect(result.examples).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('No extractors provided');
    });

    it('runs extractors in parallel and collects results', async () => {
      const example1 = createMockExample('ex1', 'extractor-a', ['/test/a.ts']);
      const example2 = createMockExample('ex2', 'extractor-b', ['/test/b.ts']);

      const extractorA = createMockExtractor(
        'extractor-a',
        [example1],
        new Set(['/test/a.ts'])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [example2],
        new Set(['/test/b.ts'])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
      });

      // Extractors are called with candidates array and options
      expect(result.examples).toHaveLength(2);
      expect(result.examples.map((e) => e.id)).toEqual(['ex1', 'ex2']);
      expect(result.errors).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('collects errors from extractors', async () => {
      const extractor = createMockExtractorWithResult('extractor-a', {
        errors: [{ path: '/test/bad.ts', message: 'Invalid syntax' }],
      });

      const result = await scanExamples({
        root: '/test',
        extractors: [extractor],
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid syntax');
    });

    it('handles extractor exceptions gracefully', async () => {
      const extractor: Extractor = {
        name: 'failing-extractor',
        extract: vi.fn().mockRejectedValue(new Error('Extractor crashed')),
      };

      const result = await scanExamples({
        root: '/test',
        extractors: [extractor],
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        'Extractor "failing-extractor" failed'
      );
      expect(result.errors[0].message).toContain('Extractor crashed');
    });
  });

  describe('conflict detection', () => {
    it('detects when multiple extractors claim the same file', async () => {
      const sharedFile = '/test/shared.ts';
      const example1 = createMockExample('ex1', 'extractor-a', [sharedFile]);
      const example2 = createMockExample('ex2', 'extractor-b', [sharedFile]);

      const extractorA = createMockExtractor(
        'extractor-a',
        [example1],
        new Set([sharedFile])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [example2],
        new Set([sharedFile])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].filePath).toBe(sharedFile);
      expect(result.conflicts[0].claimants).toEqual([
        'extractor-a',
        'extractor-b',
      ]);
      expect(result.conflicts[0].resolution).toBe('error');
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.stats.conflictsResolved).toBe(0);
    });

    it('adds error for unresolved conflicts', async () => {
      const sharedFile = '/test/shared.ts';

      const extractorA = createMockExtractor(
        'extractor-a',
        [createMockExample('ex1', 'extractor-a', [sharedFile])],
        new Set([sharedFile])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [createMockExample('ex2', 'extractor-b', [sharedFile])],
        new Set([sharedFile])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        'claimed by multiple extractors'
      );
      expect(result.errors[0].message).toContain('extractor-a');
      expect(result.errors[0].message).toContain('extractor-b');
    });

    it('excludes examples with conflicting files from results', async () => {
      const sharedFile = '/test/shared.ts';

      const extractorA = createMockExtractor(
        'extractor-a',
        [createMockExample('ex1', 'extractor-a', [sharedFile])],
        new Set([sharedFile])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [createMockExample('ex2', 'extractor-b', [sharedFile])],
        new Set([sharedFile])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
      });

      // Both examples should be excluded due to unresolved conflict
      expect(result.examples).toHaveLength(0);
    });
  });

  describe('conflict resolution via path mappings', () => {
    it('resolves conflicts using path mappings', async () => {
      const sharedFile = '/test/cli-forge/example.ts';
      const example1 = createMockExample('ex1', 'frontmatter', [sharedFile]);
      const example2 = createMockExample('ex2', 'meta-yml', [sharedFile]);

      const extractorA = createMockExtractor(
        'frontmatter',
        [example1],
        new Set([sharedFile])
      );

      const extractorB = createMockExtractor(
        'meta-yml',
        [example2],
        new Set([sharedFile])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
        pathMappings: [
          { pattern: '**/cli-forge/**', extractor: 'frontmatter' },
        ],
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('path-mapping');
      expect(result.conflicts[0].winner).toBe('frontmatter');
      expect(result.stats.conflictsResolved).toBe(1);

      // Only the winning extractor's example should be included
      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].extractorName).toBe('frontmatter');
    });

    it('ignores path mappings that do not match any claimant', async () => {
      const sharedFile = '/test/shared.ts';

      const extractorA = createMockExtractor(
        'extractor-a',
        [createMockExample('ex1', 'extractor-a', [sharedFile])],
        new Set([sharedFile])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [createMockExample('ex2', 'extractor-b', [sharedFile])],
        new Set([sharedFile])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
        pathMappings: [
          // This mapping specifies an extractor that didn't claim the file
          { pattern: '**/*.ts', extractor: 'non-existent' },
        ],
      });

      // Conflict remains unresolved
      expect(result.conflicts[0].resolution).toBe('error');
    });
  });

  describe('include/exclude filtering', () => {
    it('excludes examples matching exclude patterns', async () => {
      const example1 = createMockExample('ex1', 'extractor', [
        '/test/src/a.ts',
      ]);
      const example2 = createMockExample('ex2', 'extractor', [
        '/test/dist/b.ts',
      ]);
      example1.rootPath = '/test/src/a.ts';
      example2.rootPath = '/test/dist/b.ts';

      const extractor = createMockExtractor(
        'extractor',
        [example1, example2],
        new Set(['/test/src/a.ts', '/test/dist/b.ts'])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractor],
        exclude: ['**/dist/**'],
      });

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('ex1');
    });

    it('includes only examples matching include patterns', async () => {
      const example1 = createMockExample('ex1', 'extractor', [
        '/test/examples/a.ts',
      ]);
      const example2 = createMockExample('ex2', 'extractor', [
        '/test/src/b.ts',
      ]);
      example1.rootPath = '/test/examples/a.ts';
      example2.rootPath = '/test/src/b.ts';

      const extractor = createMockExtractor(
        'extractor',
        [example1, example2],
        new Set(['/test/examples/a.ts', '/test/src/b.ts'])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractor],
        include: ['**/examples/**'],
      });

      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].id).toBe('ex1');
    });
  });

  describe('statistics', () => {
    it('reports accurate statistics', async () => {
      const example1 = createMockExample('ex1', 'extractor-a', [
        '/test/a.ts',
        '/test/b.ts',
      ]);
      const example2 = createMockExample('ex2', 'extractor-b', ['/test/c.ts']);

      const extractorA = createMockExtractor(
        'extractor-a',
        [example1],
        new Set(['/test/a.ts', '/test/b.ts'])
      );

      const extractorB = createMockExtractor(
        'extractor-b',
        [example2],
        new Set(['/test/c.ts'])
      );

      const result = await scanExamples({
        root: '/test',
        extractors: [extractorA, extractorB],
      });

      expect(result.stats.filesClaimed).toBe(3);
      expect(result.stats.examplesFound).toBe(2);
      expect(result.stats.conflictsDetected).toBe(0);
      expect(result.stats.conflictsResolved).toBe(0);
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('scanExamples with plugins', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should run file contents through parser pipeline', async () => {
    // Create test file
    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(
      filePath,
      '// #region main\nconst x = 1;\n// #endregion main'
    );

    const parseHistory: string[] = [];

    const plugin: Plugin = {
      name: 'test-plugin',
      extensions: ['.ts'],
      extractor: {
        name: 'test-extractor',
        async extract(_candidates: Dirent[], options: ExtractorOptions) {
          return {
            examples: [
              {
                id: 'test',
                title: 'Test',
                rootPath: options.rootPath,
                files: [{ absolutePath: filePath, relativePath: 'test.ts' }],
                metadata: {},
                extractorName: 'test-extractor',
              },
            ],
            errors: [],
            claimedFiles: new Set([filePath]),
          };
        },
      },
      fileContentsParser: {
        name: 'test-parser',
        parse(ctx) {
          parseHistory.push(ctx.filePath);
          return {
            ...ctx,
            parsed: ctx.raw
              .replace(/\/\/ #region.*\n?/g, '')
              .replace(/\/\/ #endregion.*\n?/g, ''),
            hunks: [
              { id: 'main', content: 'const x = 1;', startLine: 1, endLine: 3 },
            ],
          };
        },
      },
    };

    const result = await scanExamples({
      root: tempDir,
      plugins: [plugin],
    });

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].files[0].parsed).toBe('const x = 1;\n');
    expect(result.examples[0].files[0].hunks).toHaveLength(1);
    expect(parseHistory).toContain(filePath);
  });

  it('should respect processFileContents: false', async () => {
    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, 'const x = 1;');

    let parseCalled = false;

    const plugin: Plugin = {
      name: 'test-plugin',
      extensions: ['.ts'],
      extractor: {
        name: 'test-extractor',
        async extract(_candidates: Dirent[], options: ExtractorOptions) {
          return {
            examples: [
              {
                id: 'test',
                title: 'Test',
                rootPath: options.rootPath,
                files: [{ absolutePath: filePath, relativePath: 'test.ts' }],
                metadata: {},
                extractorName: 'test-extractor',
              },
            ],
            errors: [],
            claimedFiles: new Set([filePath]),
          };
        },
      },
      fileContentsParser: {
        name: 'test-parser',
        parse(ctx) {
          parseCalled = true;
          return ctx;
        },
      },
    };

    await scanExamples({
      root: tempDir,
      plugins: [plugin],
      processFileContents: false,
    });

    expect(parseCalled).toBe(false);
  });

  it('should combine plugins and standalone extractors for backward compatibility', async () => {
    const filePath1 = path.join(tempDir, 'plugin-file.ts');
    const filePath2 = path.join(tempDir, 'extractor-file.ts');
    await fs.writeFile(filePath1, 'const a = 1;');
    await fs.writeFile(filePath2, 'const b = 2;');

    const plugin: Plugin = {
      name: 'test-plugin',
      extensions: ['.ts'],
      extractor: {
        name: 'plugin-extractor',
        async extract(_candidates: Dirent[], options: ExtractorOptions) {
          return {
            examples: [
              {
                id: 'plugin-example',
                title: 'Plugin Example',
                rootPath: options.rootPath,
                files: [
                  { absolutePath: filePath1, relativePath: 'plugin-file.ts' },
                ],
                metadata: {},
                extractorName: 'plugin-extractor',
              },
            ],
            errors: [],
            claimedFiles: new Set([filePath1]),
          };
        },
      },
    };

    const standaloneExtractor: Extractor = {
      name: 'standalone-extractor',
      async extract(_candidates: Dirent[], options: ExtractorOptions) {
        return {
          examples: [
            {
              id: 'standalone-example',
              title: 'Standalone Example',
              rootPath: options.rootPath,
              files: [
                { absolutePath: filePath2, relativePath: 'extractor-file.ts' },
              ],
              metadata: {},
              extractorName: 'standalone-extractor',
            },
          ],
          errors: [],
          claimedFiles: new Set([filePath2]),
        };
      },
    };

    const result = await scanExamples({
      root: tempDir,
      plugins: [plugin],
      extractors: [standaloneExtractor],
    });

    expect(result.examples).toHaveLength(2);
    expect(result.examples.map((e) => e.id).sort()).toEqual([
      'plugin-example',
      'standalone-example',
    ]);
  });
});

describe('scanExamples with metadata validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-validation-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should run metadata validators after extraction', async () => {
    const validateFn = vi.fn(() => ({ success: true, errors: [] }));

    const plugin: Plugin = {
      name: 'validator-plugin',
      validators: { metadata: validateFn },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [
              {
                id: 'test',
                title: 'Test',
                rootPath: tempDir,
                files: [],
                metadata: { custom: 'value' },
                extractorName: 'test',
              },
            ],
            errors: [],
            claimedFiles: new Set<string>(),
          };
        },
      },
    };

    await scanExamples({ root: tempDir, plugins: [plugin] });

    expect(validateFn).toHaveBeenCalledWith({ custom: 'value' });
  });

  it('should collect metadata validation errors', async () => {
    const plugin: Plugin = {
      name: 'strict-validator',
      validators: {
        metadata: (m: Record<string, unknown>) =>
          m.required
            ? { success: true, errors: [] }
            : {
                success: false,
                errors: [{ path: 'required', message: 'field is required' }],
              },
      },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [
              {
                id: 'missing-required',
                title: 'Test',
                rootPath: tempDir,
                files: [],
                metadata: {},
                extractorName: 'test',
              },
            ],
            errors: [],
            claimedFiles: new Set<string>(),
          };
        },
      },
    };

    const result = await scanExamples({ root: tempDir, plugins: [plugin] });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe('example:missing-required');
    expect(result.errors[0].message).toContain('required');
    expect(result.errors[0].message).toContain('strict-validator');
  });

  it('should run multiple validators and collect all errors', async () => {
    const plugin1: Plugin = {
      name: 'validator-1',
      validators: {
        metadata: () => ({
          success: false,
          errors: [{ path: 'field1', message: 'error from validator 1' }],
        }),
      },
    };

    const plugin2: Plugin = {
      name: 'validator-2',
      validators: {
        metadata: () => ({
          success: false,
          errors: [{ path: 'field2', message: 'error from validator 2' }],
        }),
      },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [
              {
                id: 'test-example',
                title: 'Test',
                rootPath: tempDir,
                files: [],
                metadata: {},
                extractorName: 'test',
              },
            ],
            errors: [],
            claimedFiles: new Set<string>(),
          };
        },
      },
    };

    const result = await scanExamples({
      root: tempDir,
      plugins: [plugin1, plugin2],
    });

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('validator-1');
    expect(result.errors[1].message).toContain('validator-2');
  });

  it('should still return examples even with validation errors', async () => {
    const plugin: Plugin = {
      name: 'strict-validator',
      validators: {
        metadata: () => ({
          success: false,
          errors: [{ path: 'field', message: 'always fails' }],
        }),
      },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [
              {
                id: 'example-1',
                title: 'Example 1',
                rootPath: tempDir,
                files: [],
                metadata: {},
                extractorName: 'test',
              },
            ],
            errors: [],
            claimedFiles: new Set<string>(),
          };
        },
      },
    };

    const result = await scanExamples({ root: tempDir, plugins: [plugin] });

    // Examples are still returned - validation errors are advisory
    expect(result.examples).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
