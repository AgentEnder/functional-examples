import fg from 'fast-glob';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  Extractor,
  ExtractorOptions,
  ExtractorResult,
  Example,
  ExampleFile,
} from 'functional-examples';

const EXTRACTOR_NAME = 'javascript-extractor';

/** Default patterns to exclude from file scanning */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
];

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
 * - Scans for JS/TS files using fast-glob
 * - Extracts frontmatter from each file
 * - Only includes files with valid frontmatter (id + title required)
 * - Loads raw content into ExampleFile
 * - Respects exclude patterns (default: node_modules, .git, dist, build)
 * - Tracks claimed files for conflict detection
 */
export function createJavaScriptExtractor(): Extractor {
  return {
    name: EXTRACTOR_NAME,

    async extract(
      rootPath: string,
      options?: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const claimedFiles = new Set<string>();

      const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(options?.exclude ?? []),
      ];

      let files: string[];
      try {
        files = await fg(FILE_PATTERNS, {
          cwd: rootPath,
          absolute: true,
          ignore: excludePatterns,
        });
      } catch {
        // Directory doesn't exist or other error
        return {
          examples: [],
          errors: [],
          claimedFiles: new Set(),
        };
      }

      for (const absolutePath of files) {
        // Check for abort signal
        if (options?.signal?.aborted) {
          break;
        }

        let content: string;
        try {
          content = await fs.readFile(absolutePath, 'utf-8');
        } catch {
          // Skip files that can't be read
          continue;
        }

        const metadata = extractFrontmatter(content);

        if (!metadata || !hasValidMetadata(metadata)) {
          continue;
        }

        // Extract id, title, description from metadata
        const { id, title, description, ...restMetadata } = metadata;

        const relativePath = path.relative(rootPath, absolutePath);

        const exampleFile: ExampleFile = {
          absolutePath,
          relativePath,
          raw: content,
        };

        const example: Example = {
          id,
          title,
          description:
            typeof description === 'string' ? description : undefined,
          rootPath: absolutePath,
          files: [exampleFile],
          metadata: restMetadata,
          extractorName: EXTRACTOR_NAME,
        };

        examples.push(example);
        claimedFiles.add(absolutePath);
      }

      return {
        examples,
        errors: [],
        claimedFiles,
      };
    },
  };
}
