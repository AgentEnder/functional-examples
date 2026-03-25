import type { ExampleFile } from '@functional-examples/devkit';
import { codeBlock } from 'markdown-factory';

/** Map of file extensions to language identifiers for code fences. */
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.sh': 'bash',
  '.bash': 'bash',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.toml': 'toml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/**
 * Infer a code fence language identifier from a file path's extension.
 */
export function langFromPath(filePath: string): string {
  const dotIdx = filePath.lastIndexOf('.');
  if (dotIdx === -1) return '';
  const ext = filePath.slice(dotIdx).toLowerCase();
  return EXT_TO_LANG[ext] ?? ext.slice(1);
}

/**
 * Select a specific hunk (region) by ID across all files.
 * Returns the matching hunk or undefined.
 *
 * Throws if the region ID matches hunks in multiple files — callers
 * should use `file('path').region('id')` to disambiguate.
 */
export function region(
  files: ExampleFile[],
  regionId: string
): { file: ExampleFile; content: string } | undefined {
  const matches: { file: ExampleFile; content: string }[] = [];
  for (const file of files) {
    if (!file.hunks) continue;
    const hunk = file.hunks.find((h) => h.id === regionId);
    if (hunk) {
      matches.push({ file, content: hunk.content });
    }
  }
  if (matches.length > 1) {
    const fileList = matches.map((m) => m.file.relativePath).join(', ');
    throw new Error(
      `region('${regionId}') is ambiguous — found in ${fileList}. ` +
        `Use file('...').region('${regionId}') to disambiguate.`
    );
  }
  return matches[0];
}

// ────────────────────────────────────────────────────────────────────────────
// FileAccessor — chainable object returned by file() helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Chainable accessor returned by `file()` in both prose and guide contexts.
 *
 * Supports two usage patterns:
 * - `<%= file('path.ts') %>` — renders the whole file (calls `toString()`)
 * - `<%= file('path.ts').region('id') %>` — renders a scoped region
 */
export interface FileAccessor {
  /** Render a region within this file as a fenced code block. */
  region(regionId: string): string;
  /** Renders the whole file as a fenced code block (called implicitly by Eta's `<%= %>`). */
  toString(): string;
}

/**
 * Create a FileAccessor for a specific file.
 *
 * @param file - The example file to wrap
 * @param title - Optional title for the fenced code block header
 */
export function createFileAccessor(
  file: ExampleFile,
  title?: string
): FileAccessor {
  const lang = langFromPath(file.relativePath);
  const content = file.parsed ?? file.raw ?? '';

  return {
    region(regionId: string): string {
      const hunk = file.region(regionId);
      if (!hunk) {
        throw new Error(
          `file('${file.relativePath}').region('${regionId}'): ` +
            `no region found with id "${regionId}" in ${file.relativePath}`
        );
      }
      const regionTitle = title
        ? `${title}#${regionId}`
        : `${file.relativePath}#${regionId}`;
      return codeBlock(hunk.content, lang, { title: regionTitle });
    },

    toString(): string {
      return codeBlock(content, lang, title ? { title } : undefined);
    },
  };
}

/**
 * Filter files by extension.
 */
export function filesByExt(
  files: ExampleFile[],
  ext: string
): ExampleFile[] {
  const normalized = ext.startsWith('.') ? ext : `.${ext}`;
  return files.filter((f) => f.relativePath.endsWith(normalized));
}

/** Extensions considered prose/documentation rather than code. */
const PROSE_EXTENSIONS = new Set(['.md', '.mdx', '.mdoc', '.txt', '.rst']);

/**
 * Check whether a file is a prose/documentation file (e.g. README.md).
 */
export function isProseFile(file: ExampleFile): boolean {
  const dotIdx = file.relativePath.lastIndexOf('.');
  if (dotIdx === -1) return false;
  return PROSE_EXTENSIONS.has(file.relativePath.slice(dotIdx).toLowerCase());
}

/**
 * Look up a hunk description from the docs metadata.
 * Returns the description string or undefined.
 */
export function hunkDescription(
  metadata: Record<string, unknown>,
  hunkId: string
): string | undefined {
  const docs = metadata.docs as
    | { hunks?: Record<string, string> }
    | undefined;
  return docs?.hunks?.[hunkId];
}

/**
 * Convert a string to a URL-friendly slug.
 * Strips backticks, lowercases, replaces non-alphanumeric runs with dashes,
 * and trims leading/trailing dashes.
 */
export function slugify(text: string): string {
  return text
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Collected template helpers exposed as `it.helpers`.
 */
export const templateHelpers = {
  codeBlock,
  langFromPath,
  region,
  filesByExt,
  isProseFile,
  hunkDescription,
  slugify,
  createFileAccessor,
} as const;

export type TemplateHelpers = typeof templateHelpers;
