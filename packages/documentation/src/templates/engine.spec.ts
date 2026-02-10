import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Example } from '@functional-examples/devkit';
import {
  buildTemplateData,
  parseTemplateName,
  substituteVars,
  loadTemplates,
  renderItemTemplate,
  renderIndexTemplate,
  getBuiltinTemplatesDir,
} from './engine.js';

function assertDefined<T>(value: T | undefined | null): asserts value is T {
  expect(value).toBeDefined();
}

function makeExample(overrides: Partial<Example> = {}): Example {
  return {
    id: 'test-example',
    title: 'Test Example',
    description: 'A test example',
    rootPath: '/tmp/examples/test',
    files: [
      {
        absolutePath: '/tmp/examples/test/index.ts',
        relativePath: 'index.ts',
        raw: 'console.log("hello");',
        parsed: 'console.log("hello");',
      },
    ],
    metadata: { id: 'test-example', title: 'Test Example' },
    extractorName: 'test-extractor',
    ...overrides,
  };
}

describe('buildTemplateData', () => {
  it('should map example fields to template data', () => {
    const example = makeExample();
    const data = buildTemplateData(example);

    expect(data.id).toBe('test-example');
    expect(data.title).toBe('Test Example');
    expect(data.description).toBe('A test example');
    expect(data.files).toHaveLength(1);
    expect(data.helpers).toBeDefined();
    expect(data.helpers.langFromPath).toBeTypeOf('function');
    expect(data.helpers.isProseFile).toBeTypeOf('function');
    expect(data.helpers.hunkDescription).toBeTypeOf('function');
    expect(data.helpers.slugify).toBeTypeOf('function');
  });
});

describe('parseTemplateName', () => {
  it('should parse a per-item template filename', () => {
    const result = parseTemplateName('@slug.md.template');
    expect(result).toEqual({
      outputPattern: '@slug.md',
      format: '.md',
      perItem: true,
      variable: 'slug',
    });
  });

  it('should parse an aggregate template filename', () => {
    const result = parseTemplateName('index.md.template');
    expect(result).toEqual({
      outputPattern: 'index.md',
      format: '.md',
      perItem: false,
    });
  });

  it('should parse markdoc per-item template', () => {
    const result = parseTemplateName('@slug.mdoc.template');
    expect(result).toEqual({
      outputPattern: '@slug.mdoc',
      format: '.mdoc',
      perItem: true,
      variable: 'slug',
    });
  });

  it('should parse markdoc index template', () => {
    const result = parseTemplateName('index.mdoc.template');
    expect(result).toEqual({
      outputPattern: 'index.mdoc',
      format: '.mdoc',
      perItem: false,
    });
  });

  it('should detect @var in a directory segment', () => {
    const result = parseTemplateName('examples/@example/index.md.template');
    expect(result).toEqual({
      outputPattern: 'examples/@example/index.md',
      format: '.md',
      perItem: true,
      variable: 'example',
    });
  });

  it('should detect @var in a deeply nested directory', () => {
    const result = parseTemplateName('docs/guides/@slug/README.mdoc.template');
    expect(result).toEqual({
      outputPattern: 'docs/guides/@slug/README.mdoc',
      format: '.mdoc',
      perItem: true,
      variable: 'slug',
    });
  });

  it('should treat nested path without @var as aggregate', () => {
    const result = parseTemplateName('api/index.md.template');
    expect(result).toEqual({
      outputPattern: 'api/index.md',
      format: '.md',
      perItem: false,
    });
  });
});

describe('substituteVars', () => {
  it('should replace @var placeholders', () => {
    expect(substituteVars('@slug.md', { slug: 'getting-started' })).toBe(
      'getting-started.md'
    );
  });

  it('should handle multiple variables', () => {
    expect(
      substituteVars('@category/@slug.md', {
        category: 'guides',
        slug: 'intro',
      })
    ).toBe('guides/intro.md');
  });

  it('should return pattern unchanged when no vars match', () => {
    expect(substituteVars('index.md', { slug: 'foo' })).toBe('index.md');
  });

  it('should substitute @var in a directory segment', () => {
    expect(
      substituteVars('examples/@example/index.md', { example: 'my-app' })
    ).toBe('examples/my-app/index.md');
  });
});

describe('loadTemplates', () => {
  it('should load built-in templates', async () => {
    const templates = await loadTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(4);

    const names = templates.map((t) => path.basename(t.sourcePath));
    expect(names).toContain('@slug.md.template');
    expect(names).toContain('@slug.mdoc.template');
    expect(names).toContain('index.md.template');
    expect(names).toContain('index.mdoc.template');
  });

  it('should correctly parse per-item vs aggregate templates', async () => {
    const templates = await loadTemplates();
    const perItem = templates.filter((t) => t.perItem);
    const aggregate = templates.filter((t) => !t.perItem);

    expect(perItem.length).toBeGreaterThanOrEqual(2);
    expect(aggregate.length).toBeGreaterThanOrEqual(2);
  });

  it('should populate content from template files', async () => {
    const templates = await loadTemplates();
    for (const t of templates) {
      expect(t.content.length).toBeGreaterThan(0);
    }
  });

  describe('nested directories', () => {
    let tmpDir: string;

    beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmpl-test-'));
      // Create a nested structure:
      //   index.md.template
      //   examples/@example/index.md.template
      await fs.writeFile(
        path.join(tmpDir, 'index.md.template'),
        '# TOC\n<%= it.examples.length %> examples'
      );
      await fs.mkdir(path.join(tmpDir, 'examples', '@example'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(tmpDir, 'examples', '@example', 'index.md.template'),
        '# <%= it.title %>'
      );
    });

    afterAll(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should discover templates in subdirectories', async () => {
      const templates = await loadTemplates(tmpDir);
      expect(templates).toHaveLength(2);

      const patterns = templates.map((t) => t.outputPattern).sort();
      expect(patterns).toEqual([
        'examples/@example/index.md',
        'index.md',
      ]);
    });

    it('should detect perItem from directory-level @var', async () => {
      const templates = await loadTemplates(tmpDir);
      const nested = templates.find((t) =>
        t.outputPattern.includes('@example')
      );
      assertDefined(nested);
      expect(nested.perItem).toBe(true);
      expect(nested.variable).toBe('example');
      expect(nested.format).toBe('.md');
    });

    it('should treat top-level template as aggregate', async () => {
      const templates = await loadTemplates(tmpDir);
      const index = templates.find(
        (t) => t.outputPattern === 'index.md'
      );
      assertDefined(index);
      expect(index.perItem).toBe(false);
    });
  });
});

describe('getBuiltinTemplatesDir', () => {
  it('should return a path ending in templates', () => {
    const dir = getBuiltinTemplatesDir();
    expect(dir).toMatch(/templates$/);
  });
});

describe('renderItemTemplate', () => {
  it('should render a markdown per-item template', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample();

    const result = await renderItemTemplate(mdTemplate, example);

    expect(result.relativePath).toBe('test-example.md');
    expect(result.content).toContain('# Test Example');
    expect(result.content).toContain('A test example');
    expect(result.content).toContain('```typescript');
    expect(result.content).toContain('console.log("hello");');
  });

  it('should render a markdoc per-item template', async () => {
    const templates = await loadTemplates();
    const mdocTemplate = templates.find(
      (t) => t.perItem && t.format === '.mdoc'
    );
    assertDefined(mdocTemplate);
    const example = makeExample();

    const result = await renderItemTemplate(mdocTemplate, example);

    expect(result.relativePath).toBe('test-example.mdoc');
    expect(result.content).toContain('# Test Example');
    expect(result.content).toContain('{% process=true %}');
    expect(result.content).toContain('{% #');
  });

  it('should render hunks when present', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample({
      files: [
        {
          absolutePath: '/tmp/test/main.ts',
          relativePath: 'main.ts',
          raw: '// full file',
          parsed: '// full file',
          hunks: [
            {
              id: 'setup',
              content: 'const x = 1;',
              startLine: 1,
              endLine: 3,
            },
          ],
        },
      ],
    });

    const result = await renderItemTemplate(mdTemplate, example);
    expect(result.content).toContain('### Region: `setup`');
    expect(result.content).toContain('```typescript\nconst x = 1;\n```');
  });

  it('should render hunk descriptions from docs metadata', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample({
      metadata: {
        id: 'test',
        title: 'Test',
        docs: {
          hunks: {
            setup: 'This section initializes the configuration.',
          },
        },
      },
      files: [
        {
          absolutePath: '/tmp/test/main.ts',
          relativePath: 'main.ts',
          raw: '// code',
          hunks: [
            {
              id: 'setup',
              content: 'const cfg = {};',
              startLine: 1,
              endLine: 3,
            },
          ],
        },
      ],
    });

    const result = await renderItemTemplate(mdTemplate, example);
    expect(result.content).toContain('### Region: `setup`');
    expect(result.content).toContain(
      'This section initializes the configuration.'
    );
    expect(result.content).toContain('```typescript\nconst cfg = {};\n```');
  });

  it('should use raw content when parsed is not available', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample({
      files: [
        {
          absolutePath: '/tmp/test/data.json',
          relativePath: 'data.json',
          raw: '{"key": "value"}',
        },
      ],
    });

    const result = await renderItemTemplate(mdTemplate, example);
    expect(result.content).toContain('```json\n{"key": "value"}\n```');
  });

  it('should render prose files before code files', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample({
      files: [
        {
          absolutePath: '/tmp/test/index.ts',
          relativePath: 'index.ts',
          raw: 'const x = 1;',
          parsed: 'const x = 1;',
        },
        {
          absolutePath: '/tmp/test/README.md',
          relativePath: 'README.md',
          raw: '# Readme\n\nSome explanation.',
          parsed: 'Some explanation.',
        },
      ],
    });

    const result = await renderItemTemplate(mdTemplate, example);

    const prosePos = result.content.indexOf('Some explanation.');
    const codePos = result.content.indexOf('## `index.ts`');
    expect(prosePos).toBeLessThan(codePos);
    expect(result.content).not.toContain('## `README.md`');
  });

  it('should render without description when not present', async () => {
    const templates = await loadTemplates();
    const mdTemplate = templates.find(
      (t) => t.perItem && t.format === '.md'
    );
    assertDefined(mdTemplate);
    const example = makeExample({ description: undefined });

    const result = await renderItemTemplate(mdTemplate, example);
    expect(result.content).toContain('# Test Example');
    expect(result.content).not.toContain('undefined');
  });

  it('should produce nested output paths from directory-level @var', async () => {
    // Simulate a template descriptor with a nested outputPattern
    const template = {
      sourcePath: '/fake/examples/@example/index.md.template',
      outputPattern: 'examples/@example/index.md',
      format: '.md',
      perItem: true,
      variable: 'example',
      content: '# <%= it.title %>',
    };
    const example = makeExample({ id: 'my-app', title: 'My App' });

    const result = await renderItemTemplate(template, example);

    expect(result.relativePath).toBe('examples/my-app/index.md');
    expect(result.content).toBe('# My App');
  });
});

describe('renderIndexTemplate', () => {
  it('should render a markdown index template', async () => {
    const templates = await loadTemplates();
    const indexTemplate = templates.find(
      (t) => !t.perItem && t.format === '.md'
    );
    assertDefined(indexTemplate);
    const examples = [
      makeExample({ id: 'example-a', title: 'Example A' }),
      makeExample({
        id: 'example-b',
        title: 'Example B',
        description: 'Second example',
      }),
    ];

    const result = await renderIndexTemplate(indexTemplate, examples);

    expect(result.relativePath).toBe('index.md');
    expect(result.content).toContain('# Examples');
    expect(result.content).toContain('[Example A](./example-a.md)');
    expect(result.content).toContain('[Example B](./example-b.md)');
    expect(result.content).toContain('Second example');
  });

  it('should render a markdoc index template', async () => {
    const templates = await loadTemplates();
    const indexTemplate = templates.find(
      (t) => !t.perItem && t.format === '.mdoc'
    );
    assertDefined(indexTemplate);
    const examples = [
      makeExample({ id: 'example-a', title: 'Example A' }),
    ];

    const result = await renderIndexTemplate(indexTemplate, examples);

    expect(result.relativePath).toBe('index.mdoc');
    expect(result.content).toContain('# Examples');
    expect(result.content).toContain('[Example A](./example-a.mdoc)');
    expect(result.content).toContain('{% #examples %}');
  });
});
