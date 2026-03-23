import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import type { TypeDocDocument } from './build-symbols.js';
import rehypeTypedoc, {
  type RehypeTypedocOptions,
} from './plugin.js';
import remarkCodeProps from './remark-code-props.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal TypeDoc JSON for a package with the given exports. */
function makeDoc(
  packageSlug: string,
  children: Array<{
    name: string;
    kind: number;
    sources?: Array<{ fileName: string }>;
  }>
): TypeDocDocument {
  return {
    packageSlug,
    json: {
      schemaVersion: '2.0',
      id: 0,
      name: packageSlug,
      variant: 'project',
      kind: 1,
      flags: {},
      symbolIdMap: {},
      files: { entries: {}, reflections: {} },
      children: children.map((c, i) => ({
        id: i + 1,
        variant: 'declaration',
        flags: {},
        ...c,
      })),
    },
  };
}

/** TypeDoc kind constants. */
const KIND = {
  Function: 64,
  Interface: 256,
  TypeAlias: 2097152,
};

/** Process raw HTML through the rehype plugin */
function processHtml(html: string, options: RehypeTypedocOptions) {
  return unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeTypedoc, options)
    .use(rehypeStringify)
    .processSync(html)
    .toString();
}

/** Process markdown through the full remark → rehype pipeline */
function processMd(md: string, options: RehypeTypedocOptions) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeProps)
    .use(remarkRehype)
    .use(rehypeTypedoc, options)
    .use(rehypeStringify)
    .processSync(md)
    .toString();
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const devkitDoc = makeDoc('devkit', [
  { name: 'createMatcher', kind: KIND.Function, sources: [{ fileName: 'packages/devkit/src/glob/index.ts' }] },
  { name: 'parseYaml', kind: KIND.Function, sources: [{ fileName: 'packages/devkit/src/yaml/index.ts' }] },
  { name: 'Extractor', kind: KIND.Interface, sources: [{ fileName: 'packages/devkit/src/types.ts' }] },
]);

const defaultOpts: RehypeTypedocOptions = {
  documents: [devkitDoc],
  buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rehypeTypedoc', () => {
  it('wraps inline code matching a symbol in an <a> tag', () => {
    const input = '<p>Use <code>createMatcher</code> to match files.</p>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain(
      '<a href="/api/devkit/create-matcher" class="typedoc-link"><code>createMatcher</code></a>'
    );
  });

  it('does not link code inside <pre> blocks', () => {
    const input = '<pre><code>createMatcher</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
    expect(result).toContain('<pre><code>createMatcher</code></pre>');
  });

  it('does not double-link code already inside <a>', () => {
    const input =
      '<p><a href="/existing"><code>createMatcher</code></a></p>';
    const result = processHtml(input, defaultOpts);
    const linkCount = (result.match(/<a /g) || []).length;
    expect(linkCount).toBe(1);
    expect(result).toContain('href="/existing"');
  });

  it('leaves unmatched code alone', () => {
    const input = '<p>Use <code>unknownFunc</code> for something.</p>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
    expect(result).toContain('<code>unknownFunc</code>');
  });

  it('handles multiple symbols in one document', () => {
    const input =
      '<p>Use <code>createMatcher</code> and <code>parseYaml</code>.</p>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    expect(result).toContain('href="/api/devkit/parse-yaml"');
  });
});

describe('symbol disambiguation', () => {
  // Plugin: defined in devkit, re-exported from core
  const reExportDocs: TypeDocDocument[] = [
    makeDoc('devkit', [
      { name: 'Plugin', kind: KIND.Interface, sources: [{ fileName: 'packages/devkit/src/index.ts' }] },
      { name: 'unique', kind: KIND.Function, sources: [{ fileName: 'packages/devkit/src/index.ts' }] },
    ]),
    makeDoc('core', [
      // Re-export: source points to devkit's dist
      { name: 'Plugin', kind: KIND.Interface, sources: [{ fileName: 'devkit/dist/types/index.d.ts' }] },
    ]),
  ];

  // Config: genuinely defined in both packages (not a re-export)
  const genuineClashDocs: TypeDocDocument[] = [
    makeDoc('devkit', [
      { name: 'Config', kind: KIND.Interface, sources: [{ fileName: 'packages/devkit/src/index.ts' }] },
    ]),
    makeDoc('core', [
      { name: 'Config', kind: KIND.Interface, sources: [{ fileName: 'packages/core/src/index.ts' }] },
    ]),
  ];

  const reExportOpts: RehypeTypedocOptions = {
    documents: reExportDocs,
    buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
  };

  const genuineClashOpts: RehypeTypedocOptions = {
    documents: genuineClashDocs,
    buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
  };

  it('resolves to the defining package when re-exports are present', () => {
    const input = '<p><code>Plugin</code></p>';
    const result = processHtml(input, reExportOpts);
    expect(result).toContain('href="/api/devkit/plugin"');
  });

  it('throws on genuinely ambiguous definitions', () => {
    const input = '<p><code>Config</code></p>';
    expect(() => processHtml(input, genuineClashOpts)).toThrow(
      /Ambiguous symbol 'Config'/
    );
  });

  it('data-pkg overrides re-export filtering', () => {
    const input = '<p><code data-pkg="core">Plugin</code></p>';
    const result = processHtml(input, reExportOpts);
    expect(result).toContain('href="/api/core/plugin"');
    expect(result).not.toContain('data-pkg');
  });

  it('data-pkg resolves genuine clash', () => {
    const input = '<p><code data-pkg="core">Config</code></p>';
    const result = processHtml(input, genuineClashOpts);
    expect(result).toContain('href="/api/core/config"');
  });

  it('returns undefined when data-pkg does not match any entry', () => {
    const input = '<p><code data-pkg="nonexistent">Plugin</code></p>';
    const result = processHtml(input, reExportOpts);
    expect(result).not.toContain('<a');
  });

  it('filters single-entry symbol by data-pkg when specified', () => {
    const input = '<p><code data-pkg="devkit">unique</code></p>';
    const result = processHtml(input, reExportOpts);
    expect(result).toContain('href="/api/devkit/unique"');
  });

  it('skips single-entry symbol when data-pkg does not match', () => {
    const input = '<p><code data-pkg="wrong">unique</code></p>';
    const result = processHtml(input, reExportOpts);
    expect(result).not.toContain('<a');
  });
});

describe('remarkCodeProps + rehypeTypedoc integration', () => {
  const ambiguousDocs: TypeDocDocument[] = [
    makeDoc('devkit', [
      { name: 'Plugin', kind: KIND.Interface, sources: [{ fileName: 'packages/devkit/src/index.ts' }] },
      { name: 'Config', kind: KIND.Interface, sources: [{ fileName: 'packages/devkit/src/index.ts' }] },
      { name: 'createMatcher', kind: KIND.Function, sources: [{ fileName: 'packages/devkit/src/glob/index.ts' }] },
    ]),
    makeDoc('core', [
      // Re-export of Plugin
      { name: 'Plugin', kind: KIND.Interface, sources: [{ fileName: 'devkit/dist/types/index.d.ts' }] },
      // Genuine clash of Config
      { name: 'Config', kind: KIND.Interface, sources: [{ fileName: 'packages/core/src/index.ts' }] },
    ]),
  ];

  const opts: RehypeTypedocOptions = {
    documents: ambiguousDocs,
    buildUrl: (pkg, sym) => `/api/${pkg}/${sym}`,
  };

  it('resolves re-exported symbol to defining package in markdown', () => {
    const md = 'Use `Plugin` for plugins.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/devkit/plugin"');
  });

  it('disambiguates genuine clash with :typedoc directive in markdown', () => {
    const md = 'Use :typedoc[Config]{pkg=core} for configuration.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/core/config"');
    expect(result).toContain('>Config</code>');
    expect(result).not.toContain('data-pkg');
  });

  it('throws on genuine clash without disambiguation in markdown', () => {
    const md = 'Use `Config` for configuration.';
    expect(() => processMd(md, opts)).toThrow(
      /Ambiguous symbol 'Config'/
    );
  });

  it('links unambiguous symbols without props', () => {
    const md = 'Use `createMatcher` to match files.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
  });

  it('allows :typedoc directive to select a re-export explicitly', () => {
    const md = 'Use :typedoc[Plugin]{pkg=core} from core.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/core/plugin"');
  });

  it('leaves non-symbol code with directive alone', () => {
    const md = 'Use :typedoc[notASymbol]{pkg=devkit} for something.';
    const result = processMd(md, opts);
    expect(result).not.toContain('<a');
    expect(result).toContain('>notASymbol</code>');
  });
});
