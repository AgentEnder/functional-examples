import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

export interface RehypeTypedocSymbol {
  name: string;
  package?: string;
  /** Full URL path, e.g. /api/devkit/create-matcher */
  path?: string;
  /** Symbol kind (function, interface, type, etc.) */
  kind?: string;
  /** True if this symbol is a re-export from another package */
  isReExport?: boolean;
}

/** Value type for the symbols map — single symbol or array when names clash */
export type SymbolEntry = RehypeTypedocSymbol | RehypeTypedocSymbol[];

export interface RehypeTypedocOptions {
  /** Map of symbol names to their metadata (single or array for clashes) */
  symbols: Map<string, SymbolEntry> | Record<string, SymbolEntry>;
  /** Build a URL for a symbol link */
  buildLink: (symbol: RehypeTypedocSymbol) => string | undefined;
}

function getTextContent(node: Element): string {
  let text = '';
  for (const child of node.children) {
    if (child.type === 'text') {
      text += (child as Text).value;
    }
  }
  return text;
}

export function lookupSymbol(
  symbols: Map<string, SymbolEntry> | Record<string, SymbolEntry>,
  name: string
): SymbolEntry | undefined {
  if (symbols instanceof Map) {
    return symbols.get(name);
  }
  return symbols[name];
}

/**
 * Resolve a symbol entry to a single symbol.
 *
 * Resolution order for ambiguous symbols (arrays):
 * 1. Explicit `data-pkg` attribute → match that package
 * 2. Filter out re-exports → if one definition remains, use it
 * 3. Still ambiguous → throw with actionable error message
 */
export function resolveSymbol(
  entry: SymbolEntry,
  name: string,
  dataPkg: string | undefined
): RehypeTypedocSymbol | undefined {
  // Single symbol — no ambiguity
  if (!Array.isArray(entry)) {
    if (dataPkg && entry.package !== dataPkg) return undefined;
    return entry;
  }

  // Array — explicit disambiguation via data-pkg
  if (dataPkg) {
    return entry.find((s) => s.package === dataPkg);
  }

  // Array — filter out re-exports to find the defining package(s)
  const definitions = entry.filter((s) => !s.isReExport);

  if (definitions.length === 1) {
    return definitions[0];
  }

  // If all entries are re-exports (no original definition found),
  // or multiple definitions exist, this is genuinely ambiguous
  const candidates = definitions.length > 0 ? definitions : entry;
  const packages = candidates.map((s) => s.package ?? 'unknown').join(', ');
  throw new Error(
    `Ambiguous symbol '${name}' exists in multiple packages: ${packages}. ` +
      `Use \`{pkg: <package>}${name}\` to disambiguate.`
  );
}

/**
 * Rehype plugin that wraps inline `<code>` elements in `<a>` tags
 * when their text content matches a known TypeDoc symbol.
 *
 * Supports `data-pkg` attribute on code elements for disambiguation
 * when a symbol name exists in multiple packages.
 */
const rehypeTypedoc: Plugin<[RehypeTypedocOptions], Root> = (options) => {
  const { symbols, buildLink } = options;

  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'code') return;
      if (index === undefined || !parent) return;

      // Skip code blocks (code inside <pre>)
      if ((parent as Element).tagName === 'pre') return;

      // Skip code already inside an <a>
      if ((parent as Element).tagName === 'a') return;

      const text = getTextContent(node);
      if (!text) return;

      const entry = lookupSymbol(symbols, text);
      if (!entry) return;

      // Check for data-pkg disambiguation attribute
      const dataPkg = node.properties?.['dataPkg'] as string | undefined;

      const symbol = resolveSymbol(entry, text, dataPkg);
      if (!symbol) return;

      const href = buildLink(symbol);
      if (!href) return;

      // Clean up the data-pkg attribute from the output
      if (node.properties?.['dataPkg']) {
        delete node.properties['dataPkg'];
      }

      // Wrap the <code> in an <a>
      const link: Element = {
        type: 'element',
        tagName: 'a',
        properties: {
          href,
          className: ['typedoc-link'],
        },
        children: [node],
      };

      (parent as Element).children[index] = link;
    });
  };
};

export default rehypeTypedoc;
