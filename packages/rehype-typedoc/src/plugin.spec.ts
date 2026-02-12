import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import rehypeTypedoc, {
  type RehypeTypedocOptions,
  type RehypeTypedocSymbol,
  type SymbolEntry,
} from './plugin.js';
import remarkCodeProps from './remark-code-props.js';

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
    .use(remarkCodeProps)
    .use(remarkRehype)
    .use(rehypeTypedoc, options)
    .use(rehypeStringify)
    .processSync(md)
    .toString();
}

const symbols = new Map<string, SymbolEntry>([
  ['createMatcher', { name: 'createMatcher', package: 'devkit' }],
  ['parseYaml', { name: 'parseYaml', package: 'devkit' }],
  ['Extractor', { name: 'Extractor', package: 'devkit' }],
]);

const buildLink = (sym: RehypeTypedocSymbol) =>
  `/api/${sym.package}/${sym.name}`;

const defaultOpts: RehypeTypedocOptions = { symbols, buildLink };

describe('rehypeTypedoc', () => {
  it('wraps inline code matching a symbol in an <a> tag', () => {
    const input = '<p>Use <code>createMatcher</code> to match files.</p>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain(
      '<a href="/api/devkit/createMatcher" class="typedoc-link"><code>createMatcher</code></a>'
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
    expect(result).toContain('href="/api/devkit/createMatcher"');
    expect(result).toContain('href="/api/devkit/parseYaml"');
  });

  it('skips linking when buildLink returns undefined', () => {
    const opts: RehypeTypedocOptions = {
      symbols,
      buildLink: () => undefined,
    };
    const input = '<p>Use <code>createMatcher</code>.</p>';
    const result = processHtml(input, opts);
    expect(result).not.toContain('<a');
  });

  it('works with a plain object instead of Map', () => {
    const objSymbols: Record<string, SymbolEntry> = {
      Extractor: { name: 'Extractor', package: 'devkit' },
    };
    const opts: RehypeTypedocOptions = {
      symbols: objSymbols,
      buildLink,
    };
    const input = '<p>The <code>Extractor</code> interface.</p>';
    const result = processHtml(input, opts);
    expect(result).toContain('href="/api/devkit/Extractor"');
  });
});

describe('symbol disambiguation', () => {
  // Plugin: defined in devkit, re-exported from core
  const reExportSymbols = new Map<string, SymbolEntry>([
    [
      'Plugin',
      [
        { name: 'Plugin', package: 'devkit', path: '/api/devkit/plugin', isReExport: false },
        { name: 'Plugin', package: 'core', path: '/api/core/plugin', isReExport: true },
      ],
    ],
    ['unique', { name: 'unique', package: 'devkit', path: '/api/devkit/unique' }],
  ]);

  // Config: genuinely defined in both packages (not a re-export)
  const genuineClashSymbols = new Map<string, SymbolEntry>([
    [
      'Config',
      [
        { name: 'Config', package: 'devkit', path: '/api/devkit/config', isReExport: false },
        { name: 'Config', package: 'core', path: '/api/core/config', isReExport: false },
      ],
    ],
  ]);

  const reExportOpts: RehypeTypedocOptions = {
    symbols: reExportSymbols,
    buildLink: (sym) => sym.path,
  };

  const genuineClashOpts: RehypeTypedocOptions = {
    symbols: genuineClashSymbols,
    buildLink: (sym) => sym.path,
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
  const ambiguousSymbols = new Map<string, SymbolEntry>([
    [
      'Plugin',
      [
        { name: 'Plugin', package: 'devkit', path: '/api/devkit/plugin', isReExport: false },
        { name: 'Plugin', package: 'core', path: '/api/core/plugin', isReExport: true },
      ],
    ],
    [
      'Config',
      [
        { name: 'Config', package: 'devkit', path: '/api/devkit/config', isReExport: false },
        { name: 'Config', package: 'core', path: '/api/core/config', isReExport: false },
      ],
    ],
    ['createMatcher', { name: 'createMatcher', package: 'devkit', path: '/api/devkit/create-matcher' }],
  ]);

  const opts: RehypeTypedocOptions = {
    symbols: ambiguousSymbols,
    buildLink: (sym) => sym.path,
  };

  it('resolves re-exported symbol to defining package in markdown', () => {
    const md = 'Use `Plugin` for plugins.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/devkit/plugin"');
  });

  it('disambiguates genuine clash with {pkg: ...} in markdown', () => {
    const md = 'Use `{pkg: core}Config` for configuration.';
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

  it('allows {pkg: ...} to select a re-export explicitly', () => {
    const md = 'Use `{pkg: core}Plugin` from core.';
    const result = processMd(md, opts);
    expect(result).toContain('href="/api/core/plugin"');
  });

  it('leaves non-symbol code with props alone', () => {
    const md = 'Use `{pkg: devkit}notASymbol` for something.';
    const result = processMd(md, opts);
    expect(result).not.toContain('<a');
    expect(result).toContain('>notASymbol</code>');
  });
});
