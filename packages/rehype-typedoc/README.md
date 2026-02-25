# rehype-typedoc

TypeDoc-aware markdown and HTML linking plugins for Unified pipelines.

## Installation

```bash
npm install rehype-typedoc
```

For directive support (`:typedoc[...]` and `::typedoc{...}`), also install `remark-directive`.

## What It Does

- Links inline `<code>` symbols to API docs.
- Links identifiers inside syntax-highlighted TypeScript/JavaScript code blocks.
- Adds directive helpers so docs authors can disambiguate symbol lookups and optionally inject signatures.

## Exports

- `rehypeTypedoc` (default): links inline code nodes.
- `rehypeTypedocCodeBlocks`: links identifiers in `<pre><code>` blocks.
- `remarkCodeProps`: converts `:typedoc[...]` and `::typedoc{...}` directives to linkable code nodes.

## Quick Start

```ts
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import rehypeTypedoc, {
  rehypeTypedocCodeBlocks,
  remarkCodeProps,
  type RehypeTypedocOptions,
} from 'rehype-typedoc';

const options: RehypeTypedocOptions = {
  symbols: new Map([
    [
      'createMatcher',
      {
        name: 'createMatcher',
        package: 'devkit',
        path: '/api/devkit/create-matcher',
      },
    ],
  ]),
  buildLink: (symbol) => symbol.path,
};

const file = await unified()
  .use(remarkParse)
  .use(remarkDirective)
  .use(remarkCodeProps)
  .use(remarkRehype)
  .use(rehypeTypedoc, options)
  .use(rehypeShiki, { theme: 'github-dark', addLanguageClass: true })
  .use(rehypeTypedocCodeBlocks, options)
  .use(rehypeStringify)
  .process('Use `createMatcher` in your plugin.');

const html = String(file);
```

## Symbol Resolution and Disambiguation

When the same symbol name exists in multiple packages, resolution order is:

1. Use `data-pkg` when present.
2. Filter out re-exports and use the defining symbol when only one remains.
3. Throw an error if multiple defining symbols still remain.

Use `:typedoc` directive attributes to set `data-pkg` from markdown:

```md
Use :typedoc[Config]{pkg=core} for core configuration.
```

## Directive Syntax

Text directive:

```md
:typedoc[createMatcher]{pkg=devkit}
```

Leaf directive (requires `resolveSignature`):

```md
::typedoc{symbol="Plugin" pkg="devkit"}
```

Provide a resolver when using leaf directives:

```ts
unified().use(remarkCodeProps, {
  resolveSignature: (symbolName, pkg) => {
    // return a TypeScript signature string for this symbol
    return undefined;
  },
});
```

## Styling

Generated links use `class="typedoc-link"`, so you can style API links independently from normal prose links.

## License

MIT
