import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

export interface RemarkCodePropsOptions {
  resolveSignature?: (symbolName: string, pkg?: string) => string | undefined;
}

interface DirectiveNode {
  type: string;
  name: string;
  attributes?: Record<string, string>;
  children: Array<{ type: string; value?: string }>;
  data?: Record<string, unknown>;
  // Properties that exist on code nodes after mutation
  lang?: string;
  value?: string;
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
  const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `data${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/**
 * Remark plugin that transforms `:typedoc` directives into code nodes
 * with `data-*` attributes. Requires `remark-directive` to run before it.
 *
 * **Text directive** — inline code with attributes:
 *   `:typedoc[createMatcher]{pkg=devkit}` → `<code data-pkg="devkit">createMatcher</code>`
 *
 * **Leaf directive** — fenced code block with resolved signature:
 *   `::typedoc{symbol="Plugin" pkg="functional-examples"}` → code block with resolved type signature
 *
 * Attributes are converted to `data-*` hast properties using camelCase
 * convention (e.g. `pkg` → `dataPkg`).
 */
const remarkCodeProps: Plugin<[RemarkCodePropsOptions?]> = (options) => {
  const resolveSignature = options?.resolveSignature;

  return (tree) => {
    // Handle text directives: :typedoc[symbolName]{attrs}
    visit(tree, 'textDirective', (node: DirectiveNode) => {
      if (node.name !== 'typedoc') return;

      const symbolText = node.children
        .filter((c) => c.type === 'text')
        .map((c) => c.value ?? '')
        .join('');

      const hProperties: Record<string, string> = {};
      if (node.attributes) {
        for (const [key, val] of Object.entries(node.attributes)) {
          hProperties[toHastDataProp(key)] = val;
        }
      }

      node.data = node.data || {};
      node.data.hName = 'code';
      node.data.hProperties = hProperties;
      node.children = [{ type: 'text', value: symbolText }];
    });

    // Handle leaf directives: ::typedoc{symbol="..." pkg="..."}
    visit(tree, 'leafDirective', (node: DirectiveNode) => {
      if (node.name !== 'typedoc') return;
      if (!resolveSignature) return;

      const symbolName = node.attributes?.symbol;
      if (!symbolName) return;

      const pkg = node.attributes?.pkg;
      const signature = resolveSignature(symbolName, pkg);
      if (!signature) return;

      // Mutate the node into a code node
      (node as unknown as Record<string, unknown>).type = 'code';
      node.lang = 'typescript';
      node.value = signature;

      // Clean up directive-specific properties
      delete (node as Partial<DirectiveNode>).children;
      delete (node as Partial<DirectiveNode>).name;
      delete (node as Partial<DirectiveNode>).attributes;
      delete node.data;
    });
  };
};

export default remarkCodeProps;
