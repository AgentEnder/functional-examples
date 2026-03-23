import rehypeParse from 'rehype-parse';
import rehypeShiki from '@shikijs/rehype';
import { rehypeGithubAlerts } from 'rehype-github-alerts';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import type { RemarkCodePropsOptions } from 'rehype-typedoc';
import { remarkCodeProps } from 'rehype-typedoc';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { Plugin } from 'unified';
import { unified } from 'unified';
import { blueprintTheme } from './highlighter.js';

// Module-level rehype-typedoc plugins — configured once, used by all renderMarkdown calls.
// These are pre-configured [plugin, options] tuples from TypedocContext.getRehypePlugins().
let _rehypePlugins: Plugin[] | undefined;

// Module-level remark-code-props options — configured once, used by all renderMarkdown calls
let _remarkCodePropsOptions: RemarkCodePropsOptions | undefined;

/**
 * Configure rehype-typedoc plugins for auto-linking inline code to API docs.
 * Call this once at startup (before rendering markdown) so that all
 * subsequent `renderMarkdown` calls automatically apply typedoc links.
 *
 * Accepts the pre-configured plugin array from `TypedocContext.getRehypePlugins()`.
 */
export function configureRehypeTypedoc(
  plugins: Plugin[]
): void {
  _rehypePlugins = plugins;
}

/**
 * Configure remark-code-props options (e.g. `resolveSignature` for `::typedoc` directives).
 * Call this once at startup so that all subsequent `renderMarkdown` calls
 * can resolve type signatures from TypeDoc data.
 */
export function configureRemarkCodeProps(
  options: RemarkCodePropsOptions
): void {
  _remarkCodePropsOptions = options;
}

/**
 * Convert a Markdown string to syntax-highlighted HTML.
 *
 * The unified pipeline:
 *   remarkParse → remarkGfm → remarkDirective → remarkCodeProps
 *     → remarkRehype (with raw HTML pass-through) → rehypeRaw → rehypeGithubAlerts
 *     → rehypeTypedoc (inline code linking, if configured)
 *     → @shikijs/rehype (syntax highlighting)
 *     → rehypeTypedocCodeBlocks (code block symbol linking, if configured)
 *     → rehypeStringify
 */
export async function renderMarkdown(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeProps, _remarkCodePropsOptions ?? {})
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeGithubAlerts, {});

  // Add rehype-typedoc plugins (inline code linking + code block linking) if configured.
  // The first plugin (rehypeTypedoc) runs before shiki; the second (rehypeTypedocCodeBlocks) after.
  if (_rehypePlugins && _rehypePlugins.length > 0) {
    processor.use(_rehypePlugins[0]);
  }

  // Syntax highlighting via @shikijs/rehype (replaces post-processing regex approach)
  // addLanguageClass preserves language info so rehypeTypedocCodeBlocks can skip non-TS blocks
  processor.use(rehypeShiki, { theme: blueprintTheme, addLanguageClass: true });

  // Add code block symbol linking after shiki highlighting
  if (_rehypePlugins && _rehypePlugins.length > 1) {
    processor.use(_rehypePlugins[1]);
  }

  processor.use(rehypeStringify);

  const file = await processor.process(md);
  return String(file);
}

/**
 * Post-process Shiki-highlighted HTML to add symbol links.
 *
 * Use this for code blocks produced by `highlighter.codeToHtml()` outside
 * the unified markdown pipeline (e.g. file explorer, prose code blocks).
 * Parses the HTML into HAST, runs rehypeTypedocCodeBlocks, then serializes.
 *
 * Returns the input unchanged if rehype-typedoc is not configured.
 */
export function linkifyCodeHtml(html: string): string {
  if (!_rehypePlugins || _rehypePlugins.length < 2) return html;

  return unified()
    .use(rehypeParse, { fragment: true })
    .use(_rehypePlugins[1])
    .use(rehypeStringify)
    .processSync(html)
    .toString();
}
