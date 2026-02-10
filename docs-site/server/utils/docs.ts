import type { ScannedExample } from '@functional-examples/devkit';
import { createGuideRenderer } from '@functional-examples/documentation';
import matter from 'gray-matter';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { renderMarkdown } from './markdown';

/** Parsed doc page from docs/*.md */
export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
  filePath: string;
  content: string;
  /** Pre-rendered HTML (populated after hydration) */
  renderedHtml: string;
}

/** Navigation item for sidebar */
export interface NavigationItem {
  title: string;
  path?: string;
  order?: number;
  children?: NavigationItem[];
}

/**
 * Scans the docs/ directory recursively for markdown files with frontmatter.
 *
 * Expected frontmatter:
 * ---
 * title: "Page Title"
 * description: "Brief description"
 * nav:
 *   section: "Getting Started"
 *   order: 1
 * ---
 */
export async function scanDocs(): Promise<DocPage[]> {
  const docsDir = join(workspaceRoot(), 'docs');
  console.log('Looking in', docsDir);
  const pages: DocPage[] = [];

  let entries: string[];
  try {
    entries = (await readdir(docsDir, { recursive: true })) as string[];
  } catch {
    console.warn('[docs-site] No docs/ directory found');
    return [];
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = join(docsDir, entry);
    const raw = await readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);

    // Compute slug from relative path: "guides/getting-started.md" → "guides/getting-started"
    const slug = entry.replace(/\.md$/, '').replace(/\\/g, '/');

    pages.push({
      slug,
      title: (data.title as string) ?? basename(entry, extname(entry)),
      description: (data.description as string) ?? '',
      section: (data.nav?.section as string) ?? 'Documentation',
      order: (data.nav?.order as number) ?? 999,
      filePath,
      content,
      renderedHtml: '',
    });
  }

  return pages.sort((a, b) => a.order - b.order);
}

/**
 * Hydrate guide pages by expanding Eta `<%= %>` example references
 * and rendering the resulting markdown to HTML.
 *
 * @param docs - Doc pages from scanDocs()
 * @param examples - Scanned examples from the functional-examples scanner
 * @returns The same doc pages with `content` expanded and `renderedHtml` populated
 */
export async function hydrateGuides(
  docs: DocPage[],
  examples: ScannedExample[]
): Promise<DocPage[]> {
  const renderer = createGuideRenderer(examples);

  const hydrated: DocPage[] = [];
  for (const doc of docs) {
    let expandedContent = doc.content;
    try {
      expandedContent = renderer.render(doc.content);
    } catch (err) {
      console.warn(
        `[docs-site] Guide hydration failed for "${doc.slug}":`,
        (err as Error).message
      );
    }

    let renderedHtml = '';
    try {
      renderedHtml = await renderMarkdown(expandedContent);
    } catch (err) {
      console.warn(
        `[docs-site] Markdown rendering failed for "${doc.slug}":`,
        (err as Error).message
      );
    }

    hydrated.push({
      ...doc,
      content: expandedContent,
      renderedHtml,
    });
  }

  return hydrated;
}

/** Build sidebar navigation from scanned docs */
export function buildDocsNavigation(docs: DocPage[]): NavigationItem[] {
  const sections = new Map<string, NavigationItem>();

  for (const doc of docs) {
    if (!sections.has(doc.section)) {
      sections.set(doc.section, {
        title: doc.section,
        order: doc.order,
        children: [],
      });
    }
    const section = sections.get(doc.section);
    section?.children?.push({
      title: doc.title,
      path: `/docs/${doc.slug}`,
      order: doc.order,
    });
  }

  // Sort children within each section
  for (const section of sections.values()) {
    section.children?.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  return Array.from(sections.values()).sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999)
  );
}

function workspaceRoot() {
  let dir = import.meta.dirname;
  while (dir !== '.' && dir) {
    if (existsSync(join(dir, 'nx.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(
    'Unable to locate workspace root from ' + import.meta.dirname
  );
}
