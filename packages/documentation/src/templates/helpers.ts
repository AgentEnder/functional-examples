import type { ExampleFile } from '@functional-examples/devkit';

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
 * Returns the first matching hunk or undefined.
 */
export function region(
  files: ExampleFile[],
  regionId: string
): { file: ExampleFile; content: string } | undefined {
  for (const file of files) {
    if (!file.hunks) continue;
    const hunk = file.hunks.find((h) => h.id === regionId);
    if (hunk) {
      return { file, content: hunk.content };
    }
  }
  return undefined;
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
  langFromPath,
  region,
  filesByExt,
  isProseFile,
  hunkDescription,
  slugify,
} as const;

export type TemplateHelpers = typeof templateHelpers;
