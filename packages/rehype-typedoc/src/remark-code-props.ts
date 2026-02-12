import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

interface InlineCodeNode {
  type: 'inlineCode';
  value: string;
  data?: {
    hProperties?: Record<string, string>;
    [key: string]: unknown;
  };
}

/**
 * Convert a kebab-case key to a camelCase `data*` hast property name.
 * e.g. `pkg` → `dataPkg`, `foo-bar` → `dataFooBar`
 *
 * In hast, HTML attributes like `data-pkg` are stored as camelCased
 * property names (`dataPkg`). We need to match this convention so
 * that rehype plugins can look them up consistently regardless of
 * whether the code came from HTML (rehype-parse) or markdown (remark-rehype).
 */
function toHastDataProp(key: string): string {
  const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return `data${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/**
 * Parse a `{key: value, key2: value2}` prefix from the start of a string.
 * Returns the parsed key-value pairs and the remaining text, or null if
 * the string doesn't start with a valid props block.
 *
 * Keys become `data*` hast properties (camelCase). Values can be unquoted
 * identifiers or quoted strings (single or double quotes).
 *
 * Examples:
 *   `{pkg: devkit}createMatcher()` → { props: { dataPkg: 'devkit' }, rest: 'createMatcher()' }
 *   `{pkg: "my lib", kind: function}foo` → { props: { dataPkg: 'my lib', dataKind: 'function' }, rest: 'foo' }
 */
function parsePropsPrefix(
  value: string
): { props: Record<string, string>; rest: string } | null {
  if (!value.startsWith('{')) return null;

  const closeBrace = value.indexOf('}');
  if (closeBrace === -1) return null;

  const inside = value.slice(1, closeBrace);
  const rest = value.slice(closeBrace + 1);

  const props: Record<string, string> = {};
  const pairs = inside.split(',');

  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) return null; // Invalid — no colon

    const key = pair.slice(0, colonIdx).trim();
    let val = pair.slice(colonIdx + 1).trim();

    if (!key) return null; // Empty key

    // Strip surrounding quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    props[toHastDataProp(key)] = val;
  }

  return { props, rest };
}

/**
 * Remark plugin that transforms inline code with a `{key: value}` prefix
 * into code nodes with `data-*` attributes.
 *
 * In markdown: `` `{pkg: devkit}createMatcher()` ``
 * Produces:    `<code data-pkg="devkit">createMatcher()</code>`
 *
 * The `{...}` prefix is parsed as comma-separated `key: value` pairs.
 * Each key becomes a `data-{key}` attribute on the resulting HTML element.
 * Values can optionally be quoted with single or double quotes.
 *
 * This is achieved via mdast's `data.hProperties` which remark-rehype
 * carries through to the hast tree.
 */
const remarkCodeProps: Plugin = () => {
  return (tree) => {
    visit(tree, 'inlineCode', (node: InlineCodeNode) => {
      const parsed = parsePropsPrefix(node.value);
      if (!parsed) return;

      node.value = parsed.rest;
      node.data = node.data || {};
      node.data.hProperties = {
        ...node.data.hProperties,
        ...parsed.props,
      };
    });
  };
};

export { parsePropsPrefix };
export default remarkCodeProps;
