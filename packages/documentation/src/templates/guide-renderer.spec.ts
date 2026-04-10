import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExampleFile, ScannedExample } from '@functional-examples/devkit';
import type { ParsedRegion } from '@functional-examples/devkit';
import { createGuideRenderer } from './guide-renderer.js';

function makeFile(
  relativePath: string,
  content: string,
  hunks?: ParsedRegion[]
): ExampleFile {
  return new ExampleFile({
    absolutePath: `/tmp/test/${relativePath}`,
    relativePath,
    raw: content,
    parsed: content,
    hunks,
  });
}

function makeExample(overrides: Partial<ScannedExample> = {}): ScannedExample {
  return new ScannedExample({
    id: 'basic-usage',
    title: 'Basic Usage',
    description: 'A basic example',
    rootPath: '/tmp/examples/basic',
    displayPath: 'basic-usage',
    files: [
      makeFile('scan.ts', 'const config = loadConfig();'),
      makeFile('index.ts', 'import { scan } from "./scan";'),
    ],
    metadata: { id: 'basic-usage', title: 'Basic Usage' },
    extractorName: 'test-extractor',
    ...overrides,
  });
}

describe('createGuideRenderer', () => {
  describe('render()', () => {
    it('should expand example().file() references', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").file("scan.ts") %>'
      );

      expect(result).toBe(
        '```typescript title="scan.ts"\nconst config = loadConfig();\n```'
      );
    });

    it('should expand example().region() references', () => {
      const examples = [
        makeExample({
          files: [
            makeFile('main.ts', '// full file', [
              {
                id: 'config-setup',
                content: 'const cfg = {};',
                startLine: 1,
                endLine: 2,
              },
            ]),
          ],
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").region("config-setup") %>'
      );

      expect(result).toBe('```typescript title="main.ts#config-setup"\nconst cfg = {};\n```');
    });

    it('should expose example metadata fields via proxy', () => {
      const examples = [
        makeExample({
          metadata: {
            id: 'basic-usage',
            title: 'Basic Usage',
            category: 'getting-started',
          },
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").metadata.category %>'
      );

      expect(result).toBe('getting-started');
    });

    it('should throw for undefined metadata properties in guide context', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render('<%= example("basic-usage").metadata.nonexistent %>')
      ).toThrow("example('basic-usage').metadata.nonexistent is not defined");
    });

    it('should include available keys in metadata error message', () => {
      const examples = [
        makeExample({
          metadata: { id: 'basic-usage', title: 'Basic Usage', category: 'guides' },
        }),
      ];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render('<%= example("basic-usage").metadata.typo %>')
      ).toThrow('Available properties: id, title, category');
    });

    it('should access nested metadata via proxy in guide context', () => {
      const examples = [
        makeExample({
          metadata: {
            id: 'basic-usage',
            title: 'Basic Usage',
            docs: { hunks: { setup: 'Initialize config' } },
          },
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").metadata.docs.hunks.setup %>'
      );

      expect(result).toBe('Initialize config');
    });

    it('should throw for undefined nested metadata in guide context', () => {
      const examples = [
        makeExample({
          metadata: { id: 'basic-usage', title: 'Basic Usage', docs: { skip: false } },
        }),
      ];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render('<%= example("basic-usage").metadata.docs.typo %>')
      ).toThrow("example('basic-usage').metadata.docs.typo is not defined");
    });

    it('should access metadata from different examples independently', () => {
      const examples = [
        makeExample({
          metadata: { id: 'basic-usage', title: 'Basic Usage', level: 'beginner' },
        }),
        makeExample({
          id: 'advanced',
          title: 'Advanced',
          metadata: { id: 'advanced', title: 'Advanced', level: 'expert' },
          files: [makeFile('plugin.ts', 'export default {};')],
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").metadata.level %> / <%= example("advanced").metadata.level %>'
      );

      expect(result).toBe('beginner / expert');
    });

    it('should mix metadata access with file helpers in the same template', () => {
      const examples = [
        makeExample({
          metadata: { id: 'basic-usage', title: 'Basic Usage', language: 'TypeScript' },
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '## <%= example("basic-usage").metadata.language %>\n\n<%= example("basic-usage").file("scan.ts") %>'
      );

      expect(result).toContain('## TypeScript');
      expect(result).toContain('```typescript');
      expect(result).toContain('const config = loadConfig();');
    });

    it('should expose example metadata', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").title %>'
      );

      expect(result).toBe('Basic Usage');
    });

    it('should expose example description', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").description %>'
      );

      expect(result).toBe('A basic example');
    });

    it('should expose examples array for index building', () => {
      const examples = [
        makeExample(),
        makeExample({ id: 'advanced', title: 'Advanced' }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render('<%= examples.length %>');

      expect(result).toBe('2');
    });

    it('should expose helpers', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= helpers.slugify("Hello World") %>'
      );

      expect(result).toBe('hello-world');
    });

    it('should throw for unknown example IDs', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render('<%= example("nonexistent").title %>')
      ).toThrow('no example found with id "nonexistent"');
    });

    it('should throw for unknown file paths within an example', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render(
          '<%= example("basic-usage").file("missing.ts") %>'
        )
      ).toThrow('no file "missing.ts"');
    });

    it('should expose custom helpers by name in templates', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples, {
        customHelpers: {
          shout: (s: unknown) => String(s).toUpperCase(),
        },
      });

      const result = renderer.render('<%= shout("hello") %>');

      expect(result).toBe('HELLO');
    });

    it('should throw for unknown regions within an example', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render(
          '<%= example("basic-usage").region("missing") %>'
        )
      ).toThrow('no region "missing"');
    });

    it('should support file().region() chaining for scoped region lookup', () => {
      const examples = [
        makeExample({
          files: [
            makeFile('auth.ts', 'auth code', [
              { id: 'middleware', content: 'auth middleware', startLine: 1, endLine: 2 },
            ]),
            makeFile('timing.ts', 'timing code', [
              { id: 'middleware', content: 'timing middleware', startLine: 1, endLine: 2 },
            ]),
          ],
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        '<%= example("basic-usage").file("auth.ts").region("middleware") %>'
      );

      expect(result).toBe('```typescript title="auth.ts#middleware"\nauth middleware\n```');
    });

    it('should throw when unscoped region() is ambiguous across files', () => {
      const examples = [
        makeExample({
          files: [
            makeFile('auth.ts', 'auth code', [
              { id: 'middleware', content: 'auth middleware', startLine: 1, endLine: 2 },
            ]),
            makeFile('timing.ts', 'timing code', [
              { id: 'middleware', content: 'timing middleware', startLine: 1, endLine: 2 },
            ]),
          ],
        }),
      ];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render(
          '<%= example("basic-usage").region("middleware") %>'
        )
      ).toThrow(/ambiguous/);
    });

    it('should throw when file().region() targets unknown region', () => {
      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);

      expect(() =>
        renderer.render(
          '<%= example("basic-usage").file("scan.ts").region("nope") %>'
        )
      ).toThrow(/no region found with id "nope"/);
    });

    it('should handle multiple example references in one template', () => {
      const examples = [
        makeExample(),
        makeExample({
          id: 'advanced',
          title: 'Advanced',
          files: [makeFile('plugin.ts', 'export default {};')],
        }),
      ];
      const renderer = createGuideRenderer(examples);

      const result = renderer.render(
        [
          '<%= example("basic-usage").file("scan.ts") %>',
          '',
          '<%= example("advanced").file("plugin.ts") %>',
        ].join('\n')
      );

      expect(result).toContain('const config = loadConfig();');
      expect(result).toContain('export default {};');
    });
  });

  describe('renderFile()', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'guide-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should read and render a file from disk', async () => {
      const guidePath = path.join(tmpDir, 'guide.md');
      await fs.writeFile(
        guidePath,
        '# Guide\n\n<%= example("basic-usage").file("scan.ts") %>',
        'utf-8'
      );

      const examples = [makeExample()];
      const renderer = createGuideRenderer(examples);
      const result = await renderer.renderFile(guidePath);

      expect(result).toContain('# Guide');
      expect(result).toContain('```typescript');
      expect(result).toContain('const config = loadConfig();');
    });
  });
});
