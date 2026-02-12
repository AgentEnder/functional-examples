import type { RehypeTypedocSymbol, SymbolEntry } from 'rehype-typedoc';
import type { ApiDocs } from './types.js';

/**
 * Build a symbols map from ApiDocs, suitable for use with rehype-typedoc.
 *
 * When multiple packages export the same symbol name, the map stores an
 * array of entries. The rehype-typedoc plugin filters out re-exports to
 * resolve ambiguity, and throws only if genuinely ambiguous definitions remain.
 */
export function buildSymbolsMap(
  docs: ApiDocs
): Map<string, SymbolEntry> {
  const map = new Map<string, SymbolEntry>();

  for (const exp of docs.allExports) {
    const sym: RehypeTypedocSymbol = {
      name: exp.name,
      package: exp.package,
      path: exp.path,
      kind: exp.kind,
      isReExport: exp.isReExport ?? false,
    };

    const existing = map.get(exp.name);
    if (!existing) {
      map.set(exp.name, sym);
    } else if (Array.isArray(existing)) {
      existing.push(sym);
    } else {
      // Promote single entry to array
      map.set(exp.name, [existing, sym]);
    }
  }

  return map;
}
