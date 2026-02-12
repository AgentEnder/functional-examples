import type { RehypeTypedocOptions } from 'rehype-typedoc';
import rehypeTypedoc, { rehypeTypedocCodeBlocks, remarkCodeProps } from 'rehype-typedoc';
import rehypeStringify from 'rehype-stringify';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type Pluggable, type PluggableList } from 'unified';

import type { ApiComment } from './types.js';

/**
 * Pre-rendered markdown fields for a single API export.
 */
export interface RenderedExportMarkdown {
  signatureCodeHtml?: string;
  returnTypeCodeHtml?: string;
  descriptionHtml?: string;
  remarksHtml?: string;
  examplesHtml?: string[];
}

/**
 * A frozen unified processor that renders markdown to HTML string.
 */
type MarkdownProcessor = { process(md: string): Promise<{ toString(): string }> };

/**
 * Build a unified processor for rendering markdown to HTML.
 *
 * The pipeline is:
 *   remarkParse → remarkGfm → remarkBreaks → remarkCodeProps → [user remarkPlugins]
 *     → remarkRehype → rehypeTypedoc → [user rehypePlugins]
 *     → rehypeTypedocCodeBlocks → rehypeStringify
 */
export function buildMarkdownProcessor(
  rehypeTypedocOptions: RehypeTypedocOptions,
  remarkPlugins: PluggableList = [],
  rehypePlugins: PluggableList = []
): MarkdownProcessor {
  const plugins: Pluggable[] = [
    remarkParse,
    remarkGfm,
    remarkBreaks,
    remarkCodeProps,
    ...remarkPlugins,
    remarkRehype,
    [rehypeTypedoc, rehypeTypedocOptions] as Pluggable,
    ...rehypePlugins,
    [rehypeTypedocCodeBlocks, rehypeTypedocOptions] as Pluggable,
    rehypeStringify,
  ];

  let processor = unified();
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processor = processor.use(plugin[0] as any, ...plugin.slice(1));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processor = processor.use(plugin as any);
    }
  }

  return processor;
}

/**
 * Render a markdown string to HTML using the given processor.
 */
async function renderMarkdown(
  processor: MarkdownProcessor,
  md: string
): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}

/**
 * Pre-render all markdown fields of an export's comment.
 *
 * - `summary` is rendered as-is (inline markdown)
 * - `remarks` is rendered as-is (block markdown)
 * - Each example is wrapped in a typescript code fence before rendering
 *   (produces syntax-highlighted `<pre><code>` blocks)
 */
export async function renderExportMarkdown(
  processor: MarkdownProcessor,
  comment: ApiComment | undefined,
  description: string | undefined,
  signature: string | undefined,
  returnType: string | undefined
): Promise<RenderedExportMarkdown> {
  const result: RenderedExportMarkdown = {};

  // Render signature as a syntax-highlighted code block
  if (signature) {
    const fenced = '```ts\n' + signature + '\n```';
    result.signatureCodeHtml = await renderMarkdown(processor, fenced);
  }

  // Render return type as a syntax-highlighted code block
  if (returnType) {
    const fenced = '```ts\n' + returnType + '\n```';
    result.returnTypeCodeHtml = await renderMarkdown(processor, fenced);
  }

  // Render description (from comment.summary or top-level description)
  const summaryText = comment?.summary ?? description;
  if (summaryText) {
    result.descriptionHtml = await renderMarkdown(processor, summaryText);
  }

  // Render remarks
  if (comment?.remarks) {
    result.remarksHtml = await renderMarkdown(processor, comment.remarks);
  }

  // Render examples — wrap each in a typescript code fence
  if (comment?.examples && comment.examples.length > 0) {
    result.examplesHtml = await Promise.all(
      comment.examples.map((example) => {
        const fenced = '```typescript\n' + example + '\n```';
        return renderMarkdown(processor, fenced);
      })
    );
  }

  return result;
}
