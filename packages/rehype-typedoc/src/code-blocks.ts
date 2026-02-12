import type { Element, ElementContent, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { RehypeTypedocOptions } from './plugin.js';
import { lookupSymbol, resolveSymbol } from './plugin.js';

/** Identifier regex: word chars starting with a letter, underscore, or $ */
const IDENTIFIER_RE = /^(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*)$/;

/** Languages where TypeDoc symbol linking makes sense */
const LINKABLE_LANGUAGES = new Set([
  'typescript', 'ts', 'tsx', 'javascript', 'js', 'jsx', 'mts', 'cts', 'mjs', 'cjs',
]);

/** Intrinsic types and keywords that should never be linked */
const SKIP_TOKENS = new Set([
  'string', 'number', 'boolean', 'void', 'undefined', 'null',
  'never', 'unknown', 'any', 'object', 'symbol', 'bigint',
  'true', 'false', 'this', 'typeof', 'keyof', 'readonly',
  'extends', 'infer', 'new', 'key', 'in', 'out', 'is',
  'function', 'class', 'interface', 'type', 'enum', 'const',
]);

interface Replacement {
  parent: Element;
  index: number;
  nodes: ElementContent[];
}

/**
 * Collect all span-to-link replacements inside a code element.
 * Mutations are deferred to avoid issues with visit's index tracking.
 */
function collectReplacements(
  code: Element,
  symbols: RehypeTypedocOptions['symbols'],
  buildLink: RehypeTypedocOptions['buildLink']
): Replacement[] {
  const replacements: Replacement[] = [];

  visit(code, 'element', (span, index, parent) => {
    if (span.tagName !== 'span') return;
    if (index === undefined || !parent) return;

    // Only process spans with a single text child
    if (span.children.length !== 1 || span.children[0].type !== 'text') return;

    const textNode = span.children[0] as Text;
    const match = IDENTIFIER_RE.exec(textNode.value);
    if (!match) return;

    const [, leading, identifier, trailing] = match;
    if (SKIP_TOKENS.has(identifier)) return;

    const entry = lookupSymbol(symbols, identifier);
    if (!entry) return;

    // In code blocks we have no data-pkg attribute, so pass undefined
    let resolved;
    try {
      resolved = resolveSymbol(entry, identifier, undefined);
    } catch {
      // Ambiguous symbol — skip silently in code blocks
      return;
    }
    if (!resolved) return;

    const href = buildLink(resolved);
    if (!href) return;

    // Build the replacement nodes.
    // Whitespace stays inside styled <span> elements (not bare text nodes)
    // to prevent collapsing in certain rendering contexts.
    const nodes: ElementContent[] = [];

    // Leading whitespace in its own span (preserves original styling)
    if (leading) {
      nodes.push({
        ...span,
        children: [{ type: 'text', value: leading }],
      } as Element);
    }

    // The identifier span wrapped in a link
    const identSpan: Element = {
      ...span,
      children: [{ type: 'text', value: identifier }],
    };

    const link: Element = {
      type: 'element',
      tagName: 'a',
      properties: {
        href,
        className: ['typedoc-link'],
      },
      children: [identSpan],
    };
    nodes.push(link);

    // Trailing whitespace in its own span (preserves original styling)
    if (trailing) {
      nodes.push({
        ...span,
        children: [{ type: 'text', value: trailing }],
      } as Element);
    }

    replacements.push({ parent: parent as Element, index, nodes });
  });

  return replacements;
}

/**
 * Rehype plugin that wraps identifier tokens inside syntax-highlighted
 * `<pre><code>` blocks with `<a>` links to their API documentation.
 *
 * Must run **after** a syntax highlighter (e.g. `@shikijs/rehype`) so
 * that code blocks contain `<span>` tokens to process.
 */
const rehypeTypedocCodeBlocks: Plugin<[RehypeTypedocOptions], Root> = (options) => {
  const { symbols, buildLink } = options;

  return (tree) => {
    visit(tree, 'element', (pre) => {
      if (pre.tagName !== 'pre') return;

      // Find the <code> child inside <pre>
      const code = pre.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code'
      );
      if (!code) return;

      // Skip non-TS/JS code blocks when language info is available.
      // Language classes (e.g. "language-bash") are added by remark-rehype
      // and optionally preserved by Shiki via addLanguageClass: true.
      // When no language class is present, we process the block (backward-compatible
      // for API docs where all code blocks are TypeScript).
      const classes = code.properties?.className;
      if (Array.isArray(classes)) {
        const langClass = classes.find(
          (c): c is string => typeof c === 'string' && c.startsWith('language-')
        );
        if (langClass) {
          const lang = langClass.slice('language-'.length);
          if (!LINKABLE_LANGUAGES.has(lang)) return;
        }
      }

      // Collect all replacements, then apply in reverse order
      // so that splice indices remain valid
      const replacements = collectReplacements(code, symbols, buildLink);
      for (let i = replacements.length - 1; i >= 0; i--) {
        const { parent, index, nodes } = replacements[i];
        parent.children.splice(index, 1, ...nodes);
      }
    });
  };
};

export default rehypeTypedocCodeBlocks;
