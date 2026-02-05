import fg from 'fast-glob';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import type {
  Extractor,
  ExtractorOptions,
  ExtractorResult,
  Example,
} from 'functional-examples';

const EXTRACTOR_NAME = 'javascript-extractor';

/** Default patterns to exclude from file scanning */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
];

/** Default directories to skip when processing directory candidates */
const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
]);

/** File extensions to scan for JavaScript/TypeScript examples */
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
  '**/*.mts',
  '**/*.cts',
];

/** File extensions this extractor handles */
const FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
];

/** Pattern matching line comment frontmatter start: // --- */
const LINE_COMMENT_START = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment frontmatter end: // --- */
const LINE_COMMENT_END = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment content: // <content> */
const LINE_COMMENT_CONTENT = /^[ \t]*\/\/\s?(.*)$/;

/** Pattern matching block comment frontmatter start: /* --- */
const BLOCK_COMMENT_START = /^[ \t]*\/\*\s*---\s*$/;
/** Pattern matching block comment frontmatter end: --- */
const BLOCK_COMMENT_END = /^[ \t]*---\s*\*\/\s*$/;

interface FrontmatterResult {
  /** Parsed YAML metadata */
  metadata: Record<string, unknown>;
}

/**
 * Try to extract line comment style frontmatter from the start of the file.
 */
function extractLineCommentFrontmatter(
  lines: string[]
): FrontmatterResult | null {
  if (lines.length < 2) return null;

  if (!LINE_COMMENT_START.test(lines[0])) {
    return null;
  }

  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (LINE_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    const match = line.match(LINE_COMMENT_CONTENT);
    if (match) {
      yamlLines.push(match[1]);
    } else {
      return null;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? (parseYaml(yamlContent) as Record<string, unknown>) ?? {}
    : {};

  return { metadata };
}

/**
 * Try to extract block comment style frontmatter from the start of the file.
 */
function extractBlockCommentFrontmatter(
  lines: string[]
): FrontmatterResult | null {
  if (lines.length < 2) return null;

  if (!BLOCK_COMMENT_START.test(lines[0])) {
    return null;
  }

  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (BLOCK_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    yamlLines.push(line);
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? (parseYaml(yamlContent) as Record<string, unknown>) ?? {}
    : {};

  return { metadata };
}

/**
 * Extract frontmatter from file content.
 */
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const lines = content.split('\n');

  const result =
    extractLineCommentFrontmatter(lines) ??
    extractBlockCommentFrontmatter(lines);

  if (!result) {
    return null;
  }

  return result.metadata;
}

/**
 * Check if metadata has valid required fields (id and title as strings).
 */
function hasValidMetadata(
  metadata: Record<string, unknown>
): metadata is Record<string, unknown> & { id: string; title: string } {
  return (
    typeof metadata.id === 'string' &&
    metadata.id.length > 0 &&
    typeof metadata.title === 'string' &&
    metadata.title.length > 0
  );
}

/**
 * Create a JavaScript/TypeScript single-file extractor.
 *
 * This extractor:
 * - Receives pre-filtered candidates (files and directories)
 * - Extracts frontmatter from JS/TS files
 * - Only includes files with valid frontmatter (id + title required)
 * - Loads raw content into ExampleFile
 * - Respects exclude patterns (default: node_modules, .git, dist, build)
 * - Tracks claimed files for conflict detection
 */
export function createJavaScriptExtractor(): Extractor {
  async function tryExtractFromFile(
    absolutePath: string,
    rootPath: string
  ): Promise<Example | null> {
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      return null;
    }

    const metadata = extractFrontmatter(content);
    if (!metadata || !hasValidMetadata(metadata)) {
      return null;
    }

    const { id, title, description, ...restMetadata } = metadata;
    const relativePath = path.relative(rootPath, absolutePath);

    return {
      id,
      title,
      description: typeof description === 'string' ? description : undefined,
      rootPath: absolutePath,
      files: [{ absolutePath, relativePath, raw: content }],
      metadata: restMetadata,
      extractorName: EXTRACTOR_NAME,
    };
  }

  async function extractFromDirectory(
    dirPath: string,
    options: ExtractorOptions
  ): Promise<Array<{ example: Example; filePath: string }>> {
    const results: Array<{ example: Example; filePath: string }> = [];

    const excludePatterns = [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...(options.exclude ?? []),
    ];

    // Use fast-glob to find JS/TS files in this directory
    let files: string[];
    try {
      files = await fg(FILE_PATTERNS, {
        cwd: dirPath,
        absolute: true,
        ignore: excludePatterns,
      });
    } catch {
      return [];
    }

    for (const filePath of files) {
      if (options.signal?.aborted) break;

      const example = await tryExtractFromFile(filePath, options.rootPath);
      if (example) {
        results.push({ example, filePath });
      }
    }

    return results;
  }

  return {
    name: EXTRACTOR_NAME,

    async extract(
      candidates: Dirent[],
      options: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const claimedFiles = new Set<string>();

      for (const candidate of candidates) {
        if (options.signal?.aborted) break;

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // Handle file candidates directly
        if (candidate.isFile()) {
          const ext = path.extname(candidate.name);
          if (!FILE_EXTENSIONS.includes(ext)) continue;

          const example = await tryExtractFromFile(fullPath, options.rootPath);
          if (example) {
            examples.push(example);
            claimedFiles.add(fullPath);
          }
          continue;
        }

        // Handle directory candidates - scan for JS/TS files inside
        if (candidate.isDirectory()) {
          // Skip excluded directories (default ones)
          if (DEFAULT_EXCLUDED_DIRS.has(candidate.name)) continue;

          // Skip directories matching custom exclude patterns
          const excludePatterns = options.exclude ?? [];
          const relativeDirPath = path.relative(options.rootPath, fullPath);
          const pathsToCheck = [
            candidate.name,
            relativeDirPath,
            `${relativeDirPath}/`,
            `${candidate.name}/`,
          ];
          const isExcluded = excludePatterns.some((pattern) => {
            const matcher = picomatch(pattern);
            return pathsToCheck.some((p) => matcher(p));
          });
          if (isExcluded) continue;

          const dirExamples = await extractFromDirectory(fullPath, options);
          for (const { example, filePath } of dirExamples) {
            examples.push(example);
            claimedFiles.add(filePath);
          }
        }
      }

      return { examples, errors: [], claimedFiles };
    },
  };
}
