import type { ScannedExample } from '@functional-examples/devkit';
import { createGuideRenderer } from '@functional-examples/documentation';
import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { renderMarkdown } from './markdown';
import { workspaceRoot } from './workspace.js';

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

/** Metadata from a category.yml file */
export interface CategoryMeta {
  title: string;
  order: number;
}

const CATEGORY_FILENAME = 'category.yml';

/** Title-case a directory name: "getting-started" → "Getting Started" */
function titleCase(dirName: string): string {
  return dirName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Scans the docs/ directory for category.yml files.
 * Returns a map from directory name (e.g. "guides") to its category metadata.
 */
export async function scanCategories(): Promise<Map<string, CategoryMeta>> {
  const docsDir = join(workspaceRoot(), 'docs');
  const categories = new Map<string, CategoryMeta>();

  let entries: string[];
  try {
    entries = (await readdir(docsDir, { recursive: true })) as string[];
  } catch {
    return categories;
  }

  for (const entry of entries) {
    if (!entry.endsWith(CATEGORY_FILENAME)) continue;
    const filePath = join(docsDir, entry);
    const raw = await readFile(filePath, 'utf-8');
    const data = parseYaml(raw) as Partial<CategoryMeta> | null;

    // Key is the directory relative to docs/, e.g. "guides"
    const dirKey = dirname(entry).replace(/\\/g, '/');

    categories.set(dirKey, {
      title: data?.title ?? titleCase(dirKey),
      order: data?.order ?? 999,
    });
  }

  return categories;
}

/**
 * Scans the docs/ directory recursively for markdown files with frontmatter.
 *
 * Section assignment is derived from the file's parent directory and its
 * category.yml metadata. Individual pages only control their order within
 * the section via `nav.order`.
 *
 * Expected frontmatter:
 * ---
 * title: "Page Title"
 * description: "Brief description"
 * nav:
 *   order: 1
 * ---
 */
export async function scanDocs(
  categories: Map<string, CategoryMeta>
): Promise<DocPage[]> {
  const docsDir = join(workspaceRoot(), 'docs');
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

    // Derive section from directory
    const dirKey = dirname(entry).replace(/\\/g, '/');
    const category = categories.get(dirKey);
    const section =
      category?.title ?? (dirKey === '.' ? 'Documentation' : titleCase(dirKey));

    pages.push({
      slug,
      title: (data.title as string) ?? basename(entry, extname(entry)),
      description: (data.description as string) ?? '',
      section,
      order: (data.nav?.order as number) ?? 999,
      filePath,
      content,
      renderedHtml: '',
    });
  }

  return pages.sort((a, b) => a.order - b.order);
}

/**
 * Extract a named region from a workspace-relative source file and return it
 * as a fenced code block. Uses `// region <id>` / `// #endregion` markers.
 *
 * Intended for use as a guide template custom helper:
 * `<%= sourceRegion('packages/foo/src/bar.ts', 'my-region') %>`
 */
function makeSourceRegionHelper(root: string) {
  return function sourceRegion(relPath: string, regionId: string): string {
    const absPath = join(root, relPath);
    let content: string;
    try {
      content = readFileSync(absPath, 'utf-8');
    } catch {
      return `<!-- sourceRegion: could not read ${relPath} -->`;
    }

    const lines = content.split('\n');
    const startRe = /\/\/\s*region\s+(\w+)/;
    const endRe = /\/\/\s*endregion/;
    const regionLines: string[] = [];
    let inside = false;

    for (const line of lines) {
      if (!inside) {
        const m = line.match(startRe);
        if (m?.[1] === regionId) {
          inside = true;
        }
      } else {
        if (endRe.test(line)) break;
        regionLines.push(line);
      }
    }

    if (regionLines.length === 0) {
      return `<!-- sourceRegion: region "${regionId}" not found in ${relPath} -->`;
    }

    const dotIdx = relPath.lastIndexOf('.');
    const lang = dotIdx === -1 ? '' : relPath.slice(dotIdx + 1);
    return `\`\`\`${lang}\n${regionLines.join('\n')}\n\`\`\``;
  };
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
  const root = workspaceRoot();
  const renderer = createGuideRenderer(examples, {
    customHelpers: { sourceRegion: makeSourceRegionHelper(root) },
  });

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

/** Build sidebar navigation from scanned docs and category metadata */
export function buildDocsNavigation(
  docs: DocPage[],
  categories: Map<string, CategoryMeta>
): NavigationItem[] {
  const sections = new Map<string, NavigationItem>();

  for (const doc of docs) {
    const dirKey = dirname(doc.slug).replace(/\\/g, '/');

    if (!sections.has(doc.section)) {
      const category = categories.get(dirKey);
      sections.set(doc.section, {
        title: doc.section,
        order: category?.order ?? 999,
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
