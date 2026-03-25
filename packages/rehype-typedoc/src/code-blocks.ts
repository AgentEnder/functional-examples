import type { Element, ElementContent, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import ts from 'typescript';
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
  // Intrinsic types
  'string', 'number', 'boolean', 'void', 'undefined', 'null',
  'never', 'unknown', 'any', 'object', 'symbol', 'bigint',
  // Literals
  'true', 'false',
  // Type-level keywords
  'this', 'typeof', 'keyof', 'readonly', 'extends', 'infer',
  'in', 'out', 'is',
  // Declaration keywords
  'function', 'class', 'interface', 'type', 'enum', 'const',
  'let', 'var', 'new', 'default', 'async', 'await',
  // Control flow
  'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally',
  // Module keywords
  'import', 'from', 'export', 'require', 'module',
  // Other JS/TS keywords
  'of', 'as', 'implements', 'abstract', 'static',
  'public', 'private', 'protected', 'declare',
  'delete', 'super', 'yield', 'with',
]);

// ---------------------------------------------------------------------------
// No-link ranges — comments and string literals
// ---------------------------------------------------------------------------

type Range = [start: number, end: number];

/** Token kinds that represent non-code content where identifiers should not be linked. */
const NO_LINK_TOKENS = new Set([
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

/**
 * Module-level scanner instance, reused across calls via setText/setTextPos.
 * Safe because rehype plugins run synchronously and sequentially.
 */
const tsScanner = ts.createScanner(
  ts.ScriptTarget.Latest,
  /* skipTrivia */ false,
  ts.LanguageVariant.Standard
);

/**
 * Use TypeScript's scanner to find all character ranges in JS/TS source
 * that should never contain linked identifiers: comments, string
 * literals, and the static parts of template literals.
 *
 * Template expression contents (`${...}`) are NOT excluded — identifiers
 * inside expressions are real code and should still be linkable.
 */
function getNoLinkRanges(code: string): Range[] {
  const ranges: Range[] = [];
  tsScanner.setText(code);

  let token: ts.SyntaxKind;
  let templateDepth = 0;

  while ((token = tsScanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    // After a template expression's closing `}`, rescan to pick up
    // the TemplateMiddle or TemplateTail that follows.
    if (token === ts.SyntaxKind.CloseBraceToken && templateDepth > 0) {
      token = tsScanner.reScanTemplateToken(/* isTaggedTemplate */ false);
      if (token === ts.SyntaxKind.TemplateTail) templateDepth--;
    }

    if (token === ts.SyntaxKind.TemplateHead) templateDepth++;

    if (NO_LINK_TOKENS.has(token)) {
      ranges.push([tsScanner.getTokenStart(), tsScanner.getTokenEnd()]);
    }
  }

  // Release reference to the code string so it can be GC'd
  tsScanner.setText('');

  return ranges;
}

/**
 * Check if a character offset falls within any no-link range.
 * Ranges are sorted by start, so we can bail early.
 */
function isInNoLinkRange(offset: number, ranges: Range[]): boolean {
  for (const [start, end] of ranges) {
    if (offset < start) return false; // past all possible ranges
    if (offset >= start && offset < end) return true;
  }
  return false;
}

/**
 * Extract the full plain text content of a HAST element tree.
 */
function extractText(node: Element | Text | ElementContent): string {
  if (node.type === 'text') return (node as Text).value;
  if ('children' in node) {
    return (node as Element).children.map(extractText).join('');
  }
  return '';
}

/**
 * Walk a HAST element tree in document order, calling `onSpan` for each
 * `<span>` with a single text child. The `textOffset` parameter gives
 * the span's character offset within the full text of the root element.
 */
function walkSpansWithOffsets(
  node: Element,
  onSpan: (span: Element, textOffset: number, index: number, parent: Element) => void
): void {
  let offset = 0;

  function walk(n: Element | Text | ElementContent, parent?: Element, childIndex?: number): void {
    if (n.type === 'text') {
      offset += (n as Text).value.length;
      return;
    }

    if (n.type !== 'element') return;
    const el = n as Element;

    if (
      el.tagName === 'span' &&
      el.children.length === 1 &&
      el.children[0].type === 'text' &&
      parent !== undefined &&
      childIndex !== undefined
    ) {
      // This is a linkable span — record its offset before descending
      onSpan(el, offset, childIndex, parent);
    }

    // Descend into children
    for (let i = 0; i < el.children.length; i++) {
      walk(el.children[i], el, i);
    }
  }

  walk(node);
}

// ---------------------------------------------------------------------------
// Span processing
// ---------------------------------------------------------------------------

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
 * Identifiers whose global text offset falls within a no-link range
 * (comments, strings) are silently skipped.
 *
 * Returns `null` when nothing in the span matched a known symbol.
 */
function splitSpanByIdentifiers(
  span: Element,
  symbols: Map<string, SymbolEntry>,
  buildLink: (sym: RehypeTypedocSymbol) => string | undefined,
  noLinkRanges: Range[],
  spanTextOffset: number
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

    // Check if this identifier falls within a comment or string literal
    const globalOffset = spanTextOffset + m.index;
    if (isInNoLinkRange(globalOffset, noLinkRanges)) continue;

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
 *
 * Before processing spans, extracts the full text and builds no-link
 * ranges (comments, strings) so that identifiers inside those regions
 * are never linked.
 */
function collectReplacements(
  code: Element,
  symbols: Map<string, SymbolEntry>,
  buildLink: (sym: RehypeTypedocSymbol) => string | undefined
): Replacement[] {
  // Extract full text and compute no-link zones
  const fullText = extractText(code);
  const noLinkRanges = getNoLinkRanges(fullText);

  const replacements: Replacement[] = [];

  walkSpansWithOffsets(code, (span, textOffset, index, parent) => {
    const nodes = splitSpanByIdentifiers(span, symbols, buildLink, noLinkRanges, textOffset);
    if (!nodes) return;

    replacements.push({ parent, index, nodes });
  });

  return replacements;
}

/**
 * Rehype plugin that wraps identifier tokens inside syntax-highlighted
 * `<pre><code>` blocks with `<a>` links to their API documentation.
 *
 * Must run **after** a syntax highlighter (e.g. `@shikijs/rehype`) so
 * that code blocks contain `<span>` tokens to process.
 *
 * Identifiers inside comments and string literals are never linked.
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
