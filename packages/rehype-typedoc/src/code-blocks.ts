import type { Element, ElementContent, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { buildSymbolsFromDocuments } from './build-symbols.js';
import type { RehypeTypedocOptions, RehypeTypedocSymbol, SymbolEntry } from './plugin.js';
import { lookupSymbol, resolveSymbol } from './plugin.js';

/** Global identifier regex: finds ALL identifiers in a text string */
const IDENTIFIER_GLOBAL_RE = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;

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
 * Scan a single `<span>` for all identifiers, resolve them against the
 * symbols map, and return replacement nodes that split the span text
 * into linked and unlinked segments.
 *
 * Returns `null` when nothing in the span matched a known symbol.
 */
function splitSpanByIdentifiers(
  span: Element,
  symbols: Map<string, SymbolEntry>,
  buildLink: (sym: RehypeTypedocSymbol) => string | undefined
): ElementContent[] | null {
  // Guard: only process spans with a single text child
  if (span.children.length !== 1 || span.children[0].type !== 'text') {
    return null;
  }

  const text = (span.children[0] as Text).value;

  // Collect all identifier matches and the hrefs they resolve to
  interface Match { start: number; end: number; identifier: string; href: string }
  const matches: Match[] = [];

  IDENTIFIER_GLOBAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IDENTIFIER_GLOBAL_RE.exec(text)) !== null) {
    const identifier = m[0];
    if (SKIP_TOKENS.has(identifier)) continue;

    const entry = lookupSymbol(symbols, identifier);
    if (!entry) continue;

    let resolved;
    try {
      resolved = resolveSymbol(entry, identifier, undefined);
    } catch {
      // Ambiguous symbol — skip silently in code blocks
      continue;
    }
    if (!resolved) continue;

    const href = buildLink(resolved);
    if (!href) continue;

    matches.push({ start: m.index, end: m.index + identifier.length, identifier, href });
  }

  if (matches.length === 0) return null;

  // Split the text into segments: gaps become plain styled spans,
  // matched identifiers become <a><span>...</span></a>.
  const nodes: ElementContent[] = [];
  let cursor = 0;

  for (const { start, end, identifier, href } of matches) {
    // Text before this match (may include non-identifier chars + unmatched identifiers)
    if (cursor < start) {
      nodes.push({
        ...span,
        children: [{ type: 'text', value: text.slice(cursor, start) }],
      } as Element);
    }

    // The matched identifier wrapped in a link
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

    cursor = end;
  }

  // Remaining text after the last match
  if (cursor < text.length) {
    nodes.push({
      ...span,
      children: [{ type: 'text', value: text.slice(cursor) }],
    } as Element);
  }

  return nodes;
}

/**
 * Collect all span-to-link replacements inside a code element.
 * Mutations are deferred to avoid issues with visit's index tracking.
 */
function collectReplacements(
  code: Element,
  symbols: Map<string, SymbolEntry>,
  buildLink: (sym: RehypeTypedocSymbol) => string | undefined
): Replacement[] {
  const replacements: Replacement[] = [];

  visit(code, 'element', (span, index, parent) => {
    if (span.tagName !== 'span') return;
    if (index === undefined || !parent) return;

    const nodes = splitSpanByIdentifiers(span, symbols, buildLink);
    if (!nodes) return;

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
  const symbols = buildSymbolsFromDocuments(options.documents, options.buildUrl);
  const buildLink = (sym: RehypeTypedocSymbol) => sym.path;

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
