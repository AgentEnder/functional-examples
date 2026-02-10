import { rehypeGithubAlerts } from 'rehype-github-alerts';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { getHighlighter } from './highlighter';

/**
 * Regex matching fenced code blocks produced by rehype-stringify.
 * Captures the language (from class="language-xxx") and the text content.
 */
const CODE_BLOCK_RE =
  /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g;

/** Decode HTML entities that rehype-stringify encodes inside code blocks. */
function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x3C;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>');
}

/**
 * Convert a Markdown string to syntax-highlighted HTML.
 *
 * 1. Parses markdown via remark (with GFM tables/strikethrough).
 * 2. Converts to HTML via rehype, allowing raw HTML pass-through.
 * 3. Post-processes fenced code blocks through Shiki so they use the
 *    blueprint syntax theme consistent with the rest of the site.
 */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeGithubAlerts, {})
    .use(rehypeStringify)
    .process(md);

  let html = String(file);

  // Replace fenced code blocks with Shiki-highlighted versions
  const highlighter = await getHighlighter();
  const replacements: Array<{ match: string; replacement: string }> = [];

  for (const m of html.matchAll(CODE_BLOCK_RE)) {
    const lang = m[1];
    const code = decodeHtmlEntities(m[2]);
    try {
      const highlighted = highlighter.codeToHtml(code, {
        lang,
        theme: 'blueprint',
      });
      replacements.push({ match: m[0], replacement: highlighted });
    } catch {
      // Language not loaded in Shiki — leave as-is
    }
  }

  for (const { match, replacement } of replacements) {
    html = html.replace(match, replacement);
  }

  return html;
}
