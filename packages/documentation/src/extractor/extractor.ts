import type {
  Example,
  Extractor,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
} from '@functional-examples/devkit';
import { parseYaml } from '@functional-examples/devkit';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const EXTRACTOR_NAME = 'markdown-frontmatter-extractor';

/** Pattern matching YAML frontmatter delimiters. */
const FRONTMATTER_FENCE = /^---\s*$/;

interface FrontmatterParseResult {
  metadata: Record<string, unknown>;
  body: string;
}

/**
 * Parse YAML frontmatter from a Markdown file.
 * Returns null if no valid frontmatter is found.
 */
async function parseFrontmatter(content: string): Promise<FrontmatterParseResult | null> {
  const lines = content.split('\n');
  if (lines.length < 2 || !FRONTMATTER_FENCE.test(lines[0])) {
    return null;
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_FENCE.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return null;

  const yamlStr = lines.slice(1, endIdx).join('\n');
  const metadata = (await parseYaml(yamlStr)) as Record<string, unknown>;

  if (typeof metadata !== 'object' || metadata === null) {
    return null;
  }

  const body = lines.slice(endIdx + 1).join('\n').trimStart();
  return { metadata, body };
}

/**
 * Create a markdown frontmatter extractor.
 *
 * Scans for .md files with YAML frontmatter containing at least `id` and `title`.
 * Treats each matching file as a single-file example.
 */
export function createMarkdownExtractor(): Extractor {
  return {
    name: EXTRACTOR_NAME,

    async extract(
      candidates: Dirent[],
      _options: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const errors: ExtractorError[] = [];
      const claimedFiles = new Set<string>();

      const mdCandidates = candidates.filter(
        (c) => c.isFile() && c.name.endsWith('.md')
      );

      for (const candidate of mdCandidates) {
        const parentPath =
          'parentPath' in candidate && typeof candidate.parentPath === 'string'
            ? candidate.parentPath
            : (candidate as Dirent & { path?: string }).path ?? '';
        const absPath = path.join(parentPath, candidate.name);

        try {
          const content = await fs.readFile(absPath, 'utf-8');
          const parsed = await parseFrontmatter(content);

          if (!parsed) continue;

          const { metadata, body } = parsed;

          // Must have id and title to be treated as an example
          if (
            typeof metadata.id !== 'string' ||
            typeof metadata.title !== 'string'
          ) {
            continue;
          }

          examples.push({
            id: metadata.id,
            title: metadata.title,
            description:
              typeof metadata.description === 'string'
                ? metadata.description
                : undefined,
            rootPath: path.dirname(absPath),
            files: [
              {
                absolutePath: absPath,
                relativePath: candidate.name,
                raw: content,
                parsed: body,
              },
            ],
            metadata,
            extractorName: EXTRACTOR_NAME,
          });

          claimedFiles.add(absPath);
        } catch (err) {
          errors.push({
            path: absPath,
            message:
              err instanceof Error ? err.message : `Failed to read ${absPath}`,
            cause: err instanceof Error ? err : undefined,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
