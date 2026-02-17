# Docs Example Embedding & TypeDoc Directive Plugin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded code blocks in docs with live example embeds and auto-generated TypeDoc signatures via remark directives.

**Architecture:** Migrate `remarkCodeProps` from custom `{key: value}` parsing to `remark-directive` syntax. Add a `::typedoc` leaf directive that embeds type signatures at build time. Create new examples and extend existing ones to replace all remaining inline code blocks with Eta template references.

**Tech Stack:** remark-directive, unified, rehype-typedoc (existing), Eta templates (existing), vitest

---

### Task 1: Add remark-directive dependency to rehype-typedoc

**Files:**
- Modify: `packages/rehype-typedoc/package.json`
- Modify: `pnpm-workspace.yaml` (if adding to catalog)

**Step 1: Add remark-directive as a dependency**

In `packages/rehype-typedoc/package.json`, add to `dependencies`:
```json
"remark-directive": "^3.0.1"
```

Also add the type package to `devDependencies`:
```json
"@types/mdast": "^4.0.4"
```

**Step 2: Install**

Run: `pnpm install`
Expected: Clean install, lockfile updated

**Step 3: Commit**

```bash
git add packages/rehype-typedoc/package.json pnpm-lock.yaml
git commit -m "chore(rehype-typedoc): add remark-directive dependency"
```

---

### Task 2: Migrate remarkCodeProps to directive-based inline code disambiguation

This task replaces the custom `{key: value}` prefix parsing with `remark-directive` text directives for inline code disambiguation.

**Files:**
- Modify: `packages/rehype-typedoc/src/remark-code-props.ts`
- Modify: `packages/rehype-typedoc/src/remark-code-props.spec.ts`
- Modify: `packages/rehype-typedoc/src/index.ts`

**Step 1: Write failing tests for the new directive syntax**

Replace the test file `packages/rehype-typedoc/src/remark-code-props.spec.ts` with tests for directive-based behavior. The new inline syntax is `:typedoc[createMatcher]{pkg=devkit}`.

```typescript
import { describe, expect, it } from 'vitest';
import remarkDirective from 'remark-directive';
import remarkCodeProps from './remark-code-props.js';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

async function process(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkCodeProps)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe('remarkCodeProps (directive-based)', () => {
  describe('text directive — inline code disambiguation', () => {
    it('converts :typedoc[symbol]{pkg=value} to <code data-pkg="value">', async () => {
      const html = await process('Use :typedoc[createMatcher]{pkg=devkit} here');
      expect(html).toContain('data-pkg="devkit"');
      expect(html).toContain('>createMatcher</code>');
    });

    it('supports multiple attributes', async () => {
      const html = await process(':typedoc[foo]{pkg=devkit kind=function}');
      expect(html).toContain('data-pkg="devkit"');
      expect(html).toContain('data-kind="function"');
      expect(html).toContain('>foo</code>');
    });

    it('works without attributes (plain symbol reference)', async () => {
      const html = await process(':typedoc[Plugin]');
      expect(html).toContain('>Plugin</code>');
    });

    it('leaves non-typedoc directives untouched', async () => {
      const html = await process(':other[text]{key=val}');
      // remark-directive nodes for unknown names pass through as-is
      expect(html).not.toContain('data-key');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx nx run rehype-typedoc:test`
Expected: FAIL — remarkCodeProps doesn't handle directive nodes yet

**Step 3: Implement the directive-based remarkCodeProps**

Replace `packages/rehype-typedoc/src/remark-code-props.ts`:

```typescript
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Convert a kebab-case key to a camelCase `data*` hast property name.
 * e.g. `pkg` → `dataPkg`, `foo-bar` → `dataFooBar`
 */
function toHastDataProp(key: string): string {
  const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `data${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

interface DirectiveNode {
  type: 'textDirective' | 'leafDirective' | 'containerDirective';
  name: string;
  children: Array<{ type: string; value?: string }>;
  attributes?: Record<string, string>;
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface RemarkCodePropsOptions {
  /**
   * Resolve a typedoc symbol name to its full TypeScript signature string.
   * Used by `::typedoc` leaf directives to embed type definitions.
   * If not provided, leaf directives are left as-is.
   */
  resolveSignature?: (symbolName: string, pkg?: string) => string | undefined;
}

/**
 * Remark plugin that processes `remark-directive` nodes named `typedoc`.
 *
 * **Text directive** (inline code disambiguation):
 *   `:typedoc[createMatcher]{pkg=devkit}`
 *   → `<code data-pkg="devkit">createMatcher</code>`
 *
 * **Leaf directive** (type signature embedding):
 *   `::typedoc{symbol="Plugin" pkg="functional-examples"}`
 *   → fenced TypeScript code block with the resolved signature
 *
 * Requires `remark-directive` to run before this plugin.
 */
const remarkCodeProps: Plugin<[RemarkCodePropsOptions?]> = (options) => {
  const resolveSignature = options?.resolveSignature;

  return (tree) => {
    visit(tree, (node) => {
      const directive = node as unknown as DirectiveNode;

      if (directive.type === 'textDirective' && directive.name === 'typedoc') {
        // Extract the symbol name from children text
        const symbolText = directive.children
          .filter((c) => c.type === 'text')
          .map((c) => c.value ?? '')
          .join('');

        // Convert attributes to data-* hast properties
        const hProperties: Record<string, string> = {};
        if (directive.attributes) {
          for (const [key, val] of Object.entries(directive.attributes)) {
            if (val) {
              hProperties[toHastDataProp(key)] = val;
            }
          }
        }

        // Transform to an inline <code> element
        directive.data = directive.data || {};
        directive.data.hName = 'code';
        directive.data.hProperties = hProperties;
        directive.children = [{ type: 'text', value: symbolText }];
      }

      if (directive.type === 'leafDirective' && directive.name === 'typedoc') {
        if (!resolveSignature) return;

        const attrs = directive.attributes ?? {};
        const symbolName = attrs['symbol'];
        if (!symbolName) return;

        const pkg = attrs['pkg'];
        const signature = resolveSignature(symbolName, pkg || undefined);
        if (!signature) return;

        // Replace the directive node with a fenced code block
        const codeNode = node as unknown as {
          type: string;
          lang: string;
          value: string;
          children?: unknown[];
          name?: string;
          attributes?: unknown;
          data?: unknown;
        };
        codeNode.type = 'code';
        codeNode.lang = 'typescript';
        codeNode.value = signature;
        delete codeNode.children;
        delete codeNode.name;
        delete codeNode.attributes;
        delete codeNode.data;
      }
    });
  };
};

export default remarkCodeProps;
```

**Step 4: Update barrel exports**

In `packages/rehype-typedoc/src/index.ts`, update the export from `remark-code-props.js`:

```typescript
export { default as remarkCodeProps } from './remark-code-props.js';
export type { RemarkCodePropsOptions } from './remark-code-props.js';
```

Remove the `parsePropsPrefix` export since it no longer exists.

**Step 5: Run tests to verify they pass**

Run: `npx nx run rehype-typedoc:test`
Expected: New directive tests PASS

**Step 6: Commit**

```bash
git add packages/rehype-typedoc/src/remark-code-props.ts packages/rehype-typedoc/src/remark-code-props.spec.ts packages/rehype-typedoc/src/index.ts
git commit -m "feat(rehype-typedoc): migrate remarkCodeProps to remark-directive"
```

---

### Task 3: Add leaf directive tests for ::typedoc embedding

**Files:**
- Modify: `packages/rehype-typedoc/src/remark-code-props.spec.ts`

**Step 1: Add tests for leaf directive (::typedoc)**

Append to the test file:

```typescript
describe('leaf directive — type signature embedding', () => {
  const resolveSignature = (name: string, pkg?: string) => {
    const signatures: Record<string, string> = {
      'Plugin': 'interface Plugin<TMetadata> {\n  name: string;\n  extractor?: Extractor<TMetadata>;\n}',
      'Extractor': 'interface Extractor<TMetadata> {\n  name: string;\n  extract(candidates: Dirent[], options?: ExtractorOptions): Promise<ExtractorResult<TMetadata>>;\n}',
    };
    return signatures[name];
  };

  async function processWithResolve(md: string): Promise<string> {
    const file = await unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkCodeProps, { resolveSignature })
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(md);
    return String(file);
  }

  it('replaces ::typedoc with a typescript code block', async () => {
    const html = await processWithResolve('::typedoc{symbol="Plugin"}');
    expect(html).toContain('<code');
    expect(html).toContain('interface Plugin');
  });

  it('passes pkg attribute to resolveSignature', async () => {
    let capturedPkg: string | undefined;
    const spy = (name: string, pkg?: string) => {
      capturedPkg = pkg;
      return `interface ${name} {}`;
    };
    const file = await unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkCodeProps, { resolveSignature: spy })
      .use(remarkRehype)
      .use(rehypeStringify)
      .process('::typedoc{symbol="Plugin" pkg="functional-examples"}');
    expect(capturedPkg).toBe('functional-examples');
  });

  it('leaves directive as-is when resolveSignature is not provided', async () => {
    const html = await process('::typedoc{symbol="Plugin"}');
    // Without resolveSignature, the directive is not transformed
    // remark-directive leaves unknown leaf directives as empty elements
    expect(html).not.toContain('interface Plugin');
  });

  it('leaves directive as-is when symbol is not found', async () => {
    const html = await processWithResolve('::typedoc{symbol="NonExistent"}');
    expect(html).not.toContain('interface');
  });
});
```

**Step 2: Run tests**

Run: `npx nx run rehype-typedoc:test`
Expected: All tests PASS (implementation was done in Task 2)

**Step 3: Commit**

```bash
git add packages/rehype-typedoc/src/remark-code-props.spec.ts
git commit -m "test(rehype-typedoc): add leaf directive tests for typedoc embedding"
```

---

### Task 4: Update consumers to use remark-directive in the pipeline

Both `docs-site/server/utils/markdown.ts` and `packages/vike-plugin-typedoc/src/markdown.ts` use `remarkCodeProps`. They need to add `remarkDirective` before it in the pipeline.

**Files:**
- Modify: `docs-site/server/utils/markdown.ts`
- Modify: `docs-site/package.json`
- Modify: `packages/vike-plugin-typedoc/src/markdown.ts`
- Modify: `packages/vike-plugin-typedoc/package.json`

**Step 1: Add remark-directive to docs-site dependencies**

In `docs-site/package.json`, add to `dependencies`:
```json
"remark-directive": "^3.0.1"
```

**Step 2: Update docs-site markdown pipeline**

In `docs-site/server/utils/markdown.ts`, add the import and use in the pipeline:

```typescript
import remarkDirective from 'remark-directive';
```

In the `renderMarkdown` function, add `.use(remarkDirective)` before `.use(remarkCodeProps)`:

```typescript
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkCodeProps)
  .use(remarkRehype, { allowDangerousHtml: true })
  // ... rest unchanged
```

**Step 3: Add remark-directive to vike-plugin-typedoc dependencies**

In `packages/vike-plugin-typedoc/package.json`, add to `dependencies`:
```json
"remark-directive": "^3.0.1"
```

**Step 4: Update vike-plugin-typedoc markdown pipeline**

In `packages/vike-plugin-typedoc/src/markdown.ts`, add the import and insert in the plugins array:

```typescript
import remarkDirective from 'remark-directive';
```

In `buildMarkdownProcessor`, update the plugins array:

```typescript
const plugins: Pluggable[] = [
  remarkParse,
  remarkGfm,
  remarkBreaks,
  remarkDirective,
  remarkCodeProps,
  ...remarkPlugins,
  // ... rest unchanged
];
```

**Step 5: Install and verify build**

Run: `pnpm install && npx nx run-many -t build`
Expected: Clean build, no errors

**Step 6: Commit**

```bash
git add docs-site/package.json docs-site/server/utils/markdown.ts packages/vike-plugin-typedoc/package.json packages/vike-plugin-typedoc/src/markdown.ts pnpm-lock.yaml
git commit -m "feat: add remark-directive to markdown pipelines"
```

---

### Task 5: Wire up resolveSignature in docs-site server context

The docs-site needs to provide the `resolveSignature` callback so `::typedoc` directives can look up real type signatures.

**Files:**
- Modify: `docs-site/server/utils/markdown.ts`
- Modify: `docs-site/pages/+onCreateGlobalContext.server.ts`

**Step 1: Read the onCreateGlobalContext file**

Read: `docs-site/pages/+onCreateGlobalContext.server.ts`
Understand how TypeDoc context is loaded and how `configureRehypeTypedoc` is called.

**Step 2: Export a configure function for remarkCodeProps options**

In `docs-site/server/utils/markdown.ts`, add a module-level variable and configure function for remarkCodeProps options:

```typescript
import type { RemarkCodePropsOptions } from 'rehype-typedoc';

let _remarkCodePropsOptions: RemarkCodePropsOptions | undefined;

export function configureRemarkCodeProps(options: RemarkCodePropsOptions): void {
  _remarkCodePropsOptions = options;
}
```

Then update the `renderMarkdown` function to pass options:

```typescript
.use(remarkCodeProps, _remarkCodePropsOptions ?? {})
```

**Step 3: Configure resolveSignature in onCreateGlobalContext**

In `docs-site/pages/+onCreateGlobalContext.server.ts`, after the TypeDoc context is loaded, configure the resolver:

```typescript
import { configureRemarkCodeProps } from '../server/utils/markdown.js';

// After loadTypedocContext:
configureRemarkCodeProps({
  resolveSignature: (symbolName, pkg) => {
    // Search allExports for matching symbol
    const exports = typedoc.apiDocs.allExports;
    const matches = exports.filter((exp) => exp.name === symbolName);

    if (pkg) {
      const match = matches.find((exp) => exp.package === pkg);
      return match?.signature;
    }

    if (matches.length === 1) return matches[0].signature;
    if (matches.length > 1) {
      console.warn(
        `Ambiguous ::typedoc symbol "${symbolName}" found in packages: ${matches.map((m) => m.package).join(', ')}. Use pkg attribute to disambiguate.`
      );
    }
    return undefined;
  },
});
```

**Step 4: Build and manually test**

Run: `npx nx run-many -t build`
Expected: Clean build

**Step 5: Commit**

```bash
git add docs-site/server/utils/markdown.ts docs-site/pages/+onCreateGlobalContext.server.ts
git commit -m "feat(docs-site): wire up resolveSignature for typedoc directives"
```

---

### Task 6: Update plugin.spec.ts in rehype-typedoc

The `plugin.spec.ts` file imports `remarkCodeProps` and may test the old `{key: value}` syntax. It needs to be updated to use `remark-directive`.

**Files:**
- Modify: `packages/rehype-typedoc/src/plugin.spec.ts`

**Step 1: Read the current test file**

Read: `packages/rehype-typedoc/src/plugin.spec.ts`
Identify any tests that use the old `{pkg: devkit}Symbol` syntax and update them to use `:typedoc[Symbol]{pkg=devkit}`.

**Step 2: Update test imports and pipeline**

Add `remarkDirective` to the test pipeline wherever `remarkCodeProps` is used. Replace any inline code using the old syntax with the new directive syntax.

**Step 3: Run all rehype-typedoc tests**

Run: `npx nx run rehype-typedoc:test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/rehype-typedoc/src/plugin.spec.ts
git commit -m "test(rehype-typedoc): update plugin tests for directive syntax"
```

---

### Task 7: Replace type definition code blocks with ::typedoc directives

**Files:**
- Modify: `docs/advanced/custom-extractors.md`
- Modify: `docs/advanced/plugin-authoring.md`

**Step 1: Update custom-extractors.md**

Replace the hardcoded `Extractor<TMetadata>` interface (lines 14-22) with:
```markdown
::typedoc{symbol="Extractor" pkg="devkit"}
```

Replace the hardcoded `ExtractorResult<TMetadata>` interface (lines 29-35) with:
```markdown
::typedoc{symbol="ExtractorResult" pkg="devkit"}
```

**Step 2: Update plugin-authoring.md**

Replace the hardcoded `Plugin<TMetadata>` interface (lines 14-24) with:
```markdown
::typedoc{symbol="Plugin" pkg="functional-examples"}
```

Replace the hardcoded `FileContentsParser` interface (lines 65-70) with:
```markdown
::typedoc{symbol="FileContentsParser" pkg="devkit"}
```

**Step 3: Commit**

```bash
git add docs/advanced/custom-extractors.md docs/advanced/plugin-authoring.md
git commit -m "docs: replace hardcoded type definitions with ::typedoc directives"
```

---

### Task 8: Create `getting-started` example

Create a new example that covers the setup walkthrough code blocks currently inline in `docs/guides/getting-started.md`.

**Files:**
- Create: `examples/getting-started/meta.yml`
- Create: `examples/getting-started/functional-examples.config.ts`
- Create: `examples/getting-started/package.json`
- Create: `examples/getting-started/src/hello.ts` (single-file frontmatter example)
- Create: `examples/getting-started/demo.sh`
- Modify: `docs/guides/getting-started.md`

**Step 1: Create example directory and files**

`examples/getting-started/meta.yml`:
```yaml
id: getting-started
title: Getting Started
description: |
  Minimal setup walkthrough showing a configuration file,
  a single-file example with frontmatter, and scanning.
tags:
  - beginner
  - getting-started
include:
  - "*.ts"
  - "*.sh"
  - "*.json"
  - "src/**/*"
docs:
  skip: true
test:
  - name: scan completes successfully
    options:
      command: bash demo.sh
    assertions:
      exitCode: 0
      stdout:
        contains: "hello"
```

`examples/getting-started/functional-examples.config.ts`:
```typescript
// #_region config
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()],
  scan: {
    root: 'src',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
// #_endregion config
```

`examples/getting-started/src/hello.ts`:
```typescript
// #_region frontmatter-example
/**
 * ---
 * id: hello
 * title: Hello World
 * description: A minimal example
 * ---
 */
export function hello() {
  return 'Hello from functional-examples!';
}
// #_endregion frontmatter-example
```

`examples/getting-started/package.json`:
```json
{
  "name": "@examples/getting-started",
  "private": true,
  "type": "module",
  "description": "Minimal setup walkthrough",
  "dependencies": {
    "functional-examples": "workspace:*",
    "@functional-examples/javascript": "workspace:*"
  },
  "devDependencies": {
    "tsx": "catalog:"
  }
}
```

`examples/getting-started/demo.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# #_region scan
npx functional-examples scan
# #_endregion scan
```

**Step 2: Install and run the example test**

Run: `pnpm install && npx functional-examples test examples/getting-started`
Expected: Test passes

**Step 3: Update getting-started.md to reference the example**

Replace the inline config block (lines 32-42) with:
```markdown
<%= example('getting-started').region('config') %>
```

Replace the single-file frontmatter example (lines 52-63) with:
```markdown
<%= example('getting-started').region('frontmatter-example') %>
```

**Step 4: Commit**

```bash
git add examples/getting-started/ docs/guides/getting-started.md
git commit -m "feat: add getting-started example and embed in docs"
```

---

### Task 9: Create `test-assertions` example

Create an example that demonstrates all assertion types, with regions for each. This replaces the many inline YAML blocks in `docs/plugins/test.md`.

**Files:**
- Create: `examples/test-assertions/meta.yml`
- Create: `examples/test-assertions/functional-examples.config.json`
- Create: `examples/test-assertions/package.json`
- Create: `examples/test-assertions/src/greeter.ts`
- Create: `examples/test-assertions/demo.sh`
- Modify: `docs/plugins/test.md`

**Step 1: Create example with assertion regions in meta.yml**

`examples/test-assertions/meta.yml`:
```yaml
id: test-assertions
title: Test Assertions Reference
description: |
  Demonstrates all available test assertion types including
  exit codes, stdout/stderr matching, file assertions,
  directory assertions, snapshots, and negation.
tags:
  - testing
  - assertions
  - reference
include:
  - "*.json"
  - "*.ts"
  - "*.sh"
  - "src/**/*"
docs:
  skip: true
# #_region exit-code-assertion
test:
  - name: exit code assertion
    options:
      command: bash demo.sh
    assertions:
      exitCode: 0
# #_endregion exit-code-assertion
# #_region stdout-assertion
  - name: stdout assertion
    options:
      command: bash demo.sh
    assertions:
      stdout:
        contains: "Hello"
        matches: "Hello.*World"
# #_endregion stdout-assertion
# #_region stderr-assertion
  - name: stderr assertion
    options:
      command: bash demo.sh 2>&1
    assertions:
      stderr:
        contains: ""
# #_endregion stderr-assertion
# #_region file-assertion
  - name: file assertion
    steps:
      - command: bash demo.sh
        assertions:
          exitCode: 0
          file:
            path: output.txt
            contains: "Hello World"
      - command: rm -f output.txt
        assertions:
          exitCode: 0
# #_endregion file-assertion
# #_region snapshot-assertion
  - name: snapshot assertion
    steps:
      - command: bash demo.sh
        assertions:
          exitCode: 0
          snapshot:
            path: output.txt
            snapshot: __snapshots__/output.txt
      - command: rm -f output.txt
        assertions:
          exitCode: 0
# #_endregion snapshot-assertion
# #_region negation-assertion
  - name: negation assertion
    options:
      command: bash demo.sh
    assertions:
      not:
        stdout:
          contains: "ERROR"
        stderr:
          contains: "Error"
# #_endregion negation-assertion
```

Note: The region tags in meta.yml might not work directly. If the YAML extractor doesn't support regions in YAML files, create a separate `assertions-reference.yml` file with the region-annotated YAML snippets instead, and reference it via `example('test-assertions').file('assertions-reference.yml')`. Test this during implementation.

`examples/test-assertions/src/greeter.ts`:
```typescript
/**
 * ---
 * id: test-assertions
 * title: Test Assertions Reference
 * ---
 */

export function greet(name: string): string {
  return `Hello ${name}`;
}
```

`examples/test-assertions/demo.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Hello World" | tee output.txt
```

**Step 2: Install and verify**

Run: `pnpm install && npx functional-examples test examples/test-assertions`
Expected: Tests pass

**Step 3: Update test.md to reference assertion regions**

Replace the inline YAML assertion blocks (lines 64-137 in `docs/plugins/test.md`) with Eta references to the test-assertions example regions or file. The exact syntax depends on whether regions work in YAML — adapt during implementation.

**Step 4: Commit**

```bash
git add examples/test-assertions/ docs/plugins/test.md
git commit -m "feat: add test-assertions example and embed in docs"
```

---

### Task 10: Create `region-markers` example

**Files:**
- Create: `examples/region-markers/meta.yml`
- Create: `examples/region-markers/functional-examples.config.json`
- Create: `examples/region-markers/package.json`
- Create: `examples/region-markers/src/regions-demo.ts`
- Create: `examples/region-markers/demo.sh`
- Modify: `docs/guides/core-concepts.md`

**Step 1: Create example**

`examples/region-markers/src/regions-demo.ts`:
```typescript
/**
 * ---
 * id: region-markers
 * title: Region Markers Demo
 * ---
 */

// #region setup
const config = loadConfig();
const scanner = createScanner(config);
// #endregion

// #region execution
const result = await scanner.scan();
console.log(result.examples);
// #endregion
```

This demonstrates the user-facing `#region` / `#endregion` syntax.

**Step 2: Update core-concepts.md**

Replace the inline region example (lines 74-84) with:
```markdown
<%= example('region-markers').file('src/regions-demo.ts') %>
```

**Step 3: Commit**

```bash
git add examples/region-markers/ docs/guides/core-concepts.md
git commit -m "feat: add region-markers example and embed in docs"
```

---

### Task 11: Create `multi-plugin-config` example

**Files:**
- Create: `examples/multi-plugin-config/meta.yml`
- Create: `examples/multi-plugin-config/functional-examples.config.ts`
- Create: `examples/multi-plugin-config/package.json`
- Create: `examples/multi-plugin-config/demo.sh`
- Modify: `docs/guides/core-concepts.md`
- Modify: `docs/guides/testing-examples.md`

**Step 1: Create example with multiple plugin configs as regions**

`examples/multi-plugin-config/functional-examples.config.ts`:
```typescript
// #_region full-config
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import { createDocumentationPlugin } from '@functional-examples/documentation';

export default {
  plugins: [
    createJavaScriptPlugin(),    // extracts from frontmatter or package.json
    createTestPlugin(),          // reads metadata.test for assertions
    createDocumentationPlugin(), // adds doc generation
  ],
};
// #_endregion full-config

// #_region test-only-config
// Simpler config with just JS + test plugins:
// import { createJavaScriptPlugin } from '@functional-examples/javascript';
// import { createTestPlugin } from '@functional-examples/test';
//
// export default {
//   plugins: [
//     createJavaScriptPlugin(),
//     createTestPlugin(),
//   ],
// };
// #_endregion test-only-config
```

Note: The commented-out region for test-only-config is not ideal. A better approach might be separate config files (`config-full.ts`, `config-test-only.ts`) with regions. Adapt during implementation.

**Step 2: Update docs to reference**

In `docs/guides/core-concepts.md`, replace the plugin config block (lines 58-66) with:
```markdown
<%= example('multi-plugin-config').region('full-config') %>
```

In `docs/guides/testing-examples.md`, replace the test plugin config block (lines 22-32) with:
```markdown
<%= example('multi-plugin-config').region('test-only-config') %>
```

**Step 3: Commit**

```bash
git add examples/multi-plugin-config/ docs/guides/core-concepts.md docs/guides/testing-examples.md
git commit -m "feat: add multi-plugin-config example and embed in docs"
```

---

### Task 12: Extend existing examples for remaining inline blocks

This task covers extending existing examples to replace the remaining inline code blocks across docs.

**Files:**
- Modify: `examples/custom-extractor/` — add region for plugin registration config
- Modify: `examples/plugin-authoring/` — add regions for schemas, validators, commands patterns
- Modify: `examples/yaml-manifest/` — add region showing meta.yml structure
- Modify: `docs/advanced/custom-extractors.md`
- Modify: `docs/advanced/plugin-authoring.md`
- Modify: `docs/plugins/yaml-manifest.md`
- Modify: `docs/guides/configuration.md`

**Step 1: Extend custom-extractor with plugin registration region**

Add a file `examples/custom-extractor/config-with-plugin.ts` (or add a region to the existing config file) that shows the plugin registration pattern currently inline at lines 63-77 of `custom-extractors.md`.

**Step 2: Extend plugin-authoring with extension point regions**

Add regions to the plugin-authoring example's INI plugin file (or new files) showing:
- `schemas` configuration pattern
- `validators` pattern
- `commands` pattern

These replace the inline blocks at lines 84-113 of `plugin-authoring.md`.

**Step 3: Extend yaml-manifest example**

Add a region in one of the existing meta.yml files (or a new annotated reference file) showing the full YAML manifest structure. This replaces the inline YAML at lines 39-48 of `yaml-manifest.md`.

**Step 4: Handle configuration.md inline blocks**

The small config snippets in `configuration.md` (scan.root, scan.include, scan.exclude, pathMappings at lines 46-81) are fragments, not complete files. Options:
- Create a `configuration-options` example with multiple small config files showing each option
- Or leave these as inline since they're illustrative fragments showing individual options

Decide during implementation based on what feels natural.

**Step 5: Update all doc files to reference the new regions/files**

Replace each inline block with the appropriate `<%= example('id').region('name') %>` or `<%= example('id').file('path') %>`.

**Step 6: Run all tests**

Run: `npx nx run-many -t test && npx functional-examples test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add examples/ docs/
git commit -m "feat: extend examples with regions for remaining doc code blocks"
```

---

### Task 13: Update inline code disambiguation in docs

If any docs currently use the `{pkg: devkit}Symbol` syntax (search found none currently), update them to the new `:typedoc[Symbol]{pkg=devkit}` syntax. Also update any documentation that explains the old syntax.

**Files:**
- Search and modify: any `.md` files under `docs/` using old syntax
- Modify: `docs/guides/core-concepts.md` if it documents the old syntax

**Step 1: Search for old syntax usage**

Search all markdown files for `{pkg:` pattern to find any usage of the old syntax.

**Step 2: Update any found instances**

Replace `{pkg: devkit}createMatcher()` → `:typedoc[createMatcher]{pkg=devkit}`

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: migrate inline code disambiguation to directive syntax"
```

---

### Task 14: Full integration test — build docs site

**Step 1: Build everything**

Run: `npx nx run-many -t build`
Expected: Clean build, no errors

**Step 2: Run all unit tests**

Run: `npx nx run-many -t test`
Expected: All tests pass

**Step 3: Run example tests**

Run: `npx functional-examples test`
Expected: All example tests pass

**Step 4: Start docs site and verify**

Tell the user to start the dev server and visually verify:
- Type definition pages render with linked signatures
- Embedded example code blocks render correctly
- No broken Eta template references

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from docs embedding migration"
```
