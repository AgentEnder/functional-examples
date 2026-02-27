import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import rehypeTypedocCodeBlocks from './code-blocks.js';
import type {
  RehypeTypedocOptions,
  RehypeTypedocSymbol,
  SymbolEntry,
} from './plugin.js';

/** Process raw HTML through the rehype code-blocks plugin */
function processHtml(html: string, options: RehypeTypedocOptions) {
  return unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeTypedocCodeBlocks, options)
    .use(rehypeStringify)
    .processSync(html)
    .toString();
}

const symbols = new Map<string, SymbolEntry>([
  ['createMatcher', { name: 'createMatcher', package: 'devkit', path: '/api/devkit/create-matcher' }],
  ['parseYaml', { name: 'parseYaml', package: 'devkit', path: '/api/devkit/parse-yaml' }],
  ['Extractor', { name: 'Extractor', package: 'devkit', path: '/api/devkit/extractor' }],
  ['ResolvedConfig', { name: 'ResolvedConfig', package: 'core', path: '/api/core/resolved-config' }],
]);

const buildLink = (sym: RehypeTypedocSymbol) => sym.path;

const defaultOpts: RehypeTypedocOptions = { symbols, buildLink };

describe('rehypeTypedocCodeBlocks', () => {
  it('links a known symbol span inside <pre><code>', () => {
    const input = '<pre><code><span style="color:#a8d0f0">createMatcher</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain(
      '<a href="/api/devkit/create-matcher" class="typedoc-link"><span style="color:#a8d0f0">createMatcher</span></a>'
    );
  });

  it('links multiple symbols in one code block', () => {
    const input =
      '<pre><code>' +
      '<span style="color:#a8d0f0">createMatcher</span>' +
      '<span style="color:#8fa4be">(</span>' +
      '<span style="color:#a8d0f0">Extractor</span>' +
      '</code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    expect(result).toContain('href="/api/devkit/extractor"');
  });

  it('skips intrinsic types', () => {
    const input = '<pre><code><span style="color:#8ec8e8">string</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
    expect(result).toContain('>string</span>');
  });

  it('skips keywords', () => {
    const keywords = ['function', 'const', 'interface', 'type', 'class', 'extends'];
    for (const kw of keywords) {
      const input = `<pre><code><span style="color:#8ec8e8">${kw}</span></code></pre>`;
      const result = processHtml(input, defaultOpts);
      expect(result).not.toContain('<a');
    }
  });

  it('skips unknown identifiers', () => {
    const input = '<pre><code><span style="color:#e8edf4">unknownFunc</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
    expect(result).toContain('>unknownFunc</span>');
  });

  it('handles whitespace-prefixed tokens (splits whitespace)', () => {
    const input = '<pre><code><span style="color:#a8d0f0"> ResolvedConfig</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    // Leading space should be in its own styled span, outside the link
    expect(result).toContain(
      '<span style="color:#a8d0f0"> </span><a href="/api/core/resolved-config" class="typedoc-link"><span style="color:#a8d0f0">ResolvedConfig</span></a>'
    );
  });

  it('handles trailing whitespace tokens', () => {
    const input = '<pre><code><span style="color:#a8d0f0">createMatcher </span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('href="/api/devkit/create-matcher"');
    // Trailing space should be in its own styled span, outside the link
    expect(result).toContain('</a><span style="color:#a8d0f0"> </span>');
  });

  it('does not touch code outside <pre> (inline code)', () => {
    const input = '<p><code>createMatcher</code></p>';
    const result = processHtml(input, defaultOpts);
    // Should not add links — inline code is handled by the other plugin
    expect(result).not.toContain('<a');
  });

  it('does not touch spans with multiple text children', () => {
    const input =
      '<pre><code><span style="color:#a8d0f0">createMatcher<em>!</em></span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
  });

  it('does not touch non-identifier text', () => {
    const input = '<pre><code><span style="color:#8fa4be">( )</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).not.toContain('<a');
  });

  it('skips linking when buildLink returns undefined', () => {
    const opts: RehypeTypedocOptions = {
      symbols,
      buildLink: () => undefined,
    };
    const input = '<pre><code><span style="color:#a8d0f0">createMatcher</span></code></pre>';
    const result = processHtml(input, opts);
    expect(result).not.toContain('<a');
  });

  it('silently skips ambiguous symbols in code blocks', () => {
    const ambiguousSymbols = new Map<string, SymbolEntry>([
      [
        'Config',
        [
          { name: 'Config', package: 'devkit', path: '/api/devkit/config', isReExport: false },
          { name: 'Config', package: 'core', path: '/api/core/config', isReExport: false },
        ],
      ],
    ]);
    const opts: RehypeTypedocOptions = { symbols: ambiguousSymbols, buildLink };
    const input = '<pre><code><span style="color:#a8d0f0">Config</span></code></pre>';
    // Should not throw, should skip silently
    const result = processHtml(input, opts);
    expect(result).not.toContain('<a');
    expect(result).toContain('>Config</span>');
  });

  it('resolves re-exported symbols to the defining package', () => {
    const reExportSymbols = new Map<string, SymbolEntry>([
      [
        'Plugin',
        [
          { name: 'Plugin', package: 'devkit', path: '/api/devkit/plugin', isReExport: false },
          { name: 'Plugin', package: 'core', path: '/api/core/plugin', isReExport: true },
        ],
      ],
    ]);
    const opts: RehypeTypedocOptions = { symbols: reExportSymbols, buildLink };
    const input = '<pre><code><span style="color:#a8d0f0">Plugin</span></code></pre>';
    const result = processHtml(input, opts);
    expect(result).toContain('href="/api/devkit/plugin"');
  });

  it('preserves span attributes (style) in the linked span', () => {
    const input = '<pre><code><span style="color:#a8d0f0">createMatcher</span></code></pre>';
    const result = processHtml(input, defaultOpts);
    expect(result).toContain('style="color:#a8d0f0"');
    expect(result).toContain('class="typedoc-link"');
  });

  describe('multi-token spans', () => {
    it('links identifiers inside { Foo } import-style spans', () => {
      const input =
        '<pre><code class="language-typescript"><span style="color:#a8d0f0"> { createMatcher } </span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
      expect(result).toContain('class="typedoc-link"');
    });

    it('links multiple identifiers in one span', () => {
      const input =
        '<pre><code class="language-typescript"><span style="color:#a8d0f0"> { createMatcher, Extractor } </span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
      expect(result).toContain('href="/api/devkit/extractor"');
    });

    it('preserves non-identifier text around linked identifiers', () => {
      const input =
        '<pre><code class="language-typescript"><span style="color:#a8d0f0"> { createMatcher } </span></code></pre>';
      const result = processHtml(input, defaultOpts);
      // The braces and surrounding whitespace should still be present
      expect(result).toContain('{ ');
      expect(result).toContain(' }');
    });

    it('skips spans with no matching identifiers', () => {
      const input =
        '<pre><code class="language-typescript"><span style="color:#a8d0f0"> { unknownThing } </span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).not.toContain('<a');
      expect(result).toContain('unknownThing');
    });

    it('handles mixed matched and unmatched identifiers', () => {
      const input =
        '<pre><code class="language-typescript"><span style="color:#a8d0f0"> { createMatcher, unknownThing } </span></code></pre>';
      const result = processHtml(input, defaultOpts);
      // createMatcher should be linked
      expect(result).toContain('href="/api/devkit/create-matcher"');
      // unknownThing should NOT be linked but should still appear in the output
      expect(result).toContain('unknownThing');
      // Only one link should be present
      const linkCount = (result.match(/typedoc-link/g) ?? []).length;
      expect(linkCount).toBe(1);
    });
  });

  describe('language filtering', () => {
    it('links symbols in typescript code blocks', () => {
      const input = '<pre><code class="language-typescript"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
    });

    it('links symbols in ts code blocks', () => {
      const input = '<pre><code class="language-ts"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
    });

    it('links symbols in javascript code blocks', () => {
      const input = '<pre><code class="language-javascript"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
    });

    it('skips bash code blocks', () => {
      const input = '<pre><code class="language-bash"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).not.toContain('<a');
    });

    it('skips yaml code blocks', () => {
      const input = '<pre><code class="language-yaml"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).not.toContain('<a');
    });

    it('skips json code blocks', () => {
      const input = '<pre><code class="language-json"><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).not.toContain('<a');
    });

    it('still links when no language class is present (backward-compatible)', () => {
      const input = '<pre><code><span style="color:#a8d0f0">createMatcher</span></code></pre>';
      const result = processHtml(input, defaultOpts);
      expect(result).toContain('href="/api/devkit/create-matcher"');
    });
  });
});
