import { renderProseFiles } from '@functional-examples/documentation';
import type { ParsedRegion } from 'functional-examples';
import {
  ExampleFile,
  findConfigFile,
  loadConfig,
  resolveConfig,
  scanExamples,
  ScannedExample,
} from 'functional-examples';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getHighlighter } from './highlighter';
import { linkifyCodeHtml, renderMarkdown } from './markdown';
import { parseProseToBlocks } from './prose-parser';

export type { ParsedRegion };

/** Shape of an example file with pre-highlighted HTML */
export class SiteExampleFile extends ExampleFile {
  readonly language: string;
  readonly highlightedHtml: string;

  constructor(data: {
    absolutePath: string;
    relativePath: string;
    raw?: string;
    parsed?: string;
    hunks?: ParsedRegion[];
    language: string;
    highlightedHtml: string;
  }) {
    super(data);
    this.language = data.language;
    this.highlightedHtml = data.highlightedHtml;
  }

  /** Resolved display content: parsed (markers stripped) → raw → empty string */
  get content(): string {
    return this.parsed ?? this.raw ?? '';
  }
}

/** A structured segment of prose content */
export type ProseBlock =
  | { type: 'html'; html: string }
  | {
      type: 'code';
      file: string;
      region?: string;
      regionLabel?: string;
      language: string;
      code: string;
      highlightedHtml: string;
      startLine?: number;
      endLine?: number;
    };

/** An example enriched with docs-site rendering data */
export class SiteExample extends ScannedExample {
  /** Narrowed to SiteExampleFile[] (no new JS emitted) */
  declare readonly files: SiteExampleFile[];
  /** Whether a README.md exists among the files */
  readonly hasReadme: boolean;
  /** Tags extracted from metadata */
  readonly tags: string[];
  /** Pre-rendered prose HTML from README.md (with expanded region/file refs) */
  readonly renderedProseHtml: string | null;
  /** Structured prose blocks for interactive rendering */
  readonly proseBlocks: ProseBlock[] | null;

  constructor(
    data: ConstructorParameters<
      typeof ScannedExample<{ tags: string[] }>
    >[0] & {
      files: SiteExampleFile[];
      hasReadme: boolean;
      tags: string[];
      renderedProseHtml: string | null;
      proseBlocks: ProseBlock[] | null;
    }
  ) {
    super(data);
    this.hasReadme = data.hasReadme;
    this.tags = data.tags;
    this.renderedProseHtml = data.renderedProseHtml;
    this.proseBlocks = data.proseBlocks;
  }
}

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.jsonc': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.css': 'css',
  '.html': 'html',
  '.sh': 'bash',
  '.bash': 'bash',
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANG_MAP[ext] ?? 'text';
}

async function loadFileContent(file: ExampleFile): Promise<string> {
  if (file.parsed) return file.parsed;
  if (file.raw) return file.raw;
  try {
    return await readFile(file.absolutePath, 'utf-8');
  } catch {
    return `// Could not read file: ${file.relativePath}`;
  }
}

async function transformFile(
  file: ExampleFile,
  highlighter: Awaited<ReturnType<typeof getHighlighter>>
): Promise<SiteExampleFile> {
  const rawContent = await loadFileContent(file);
  const language = detectLanguage(file.relativePath);

  let highlightedHtml: string;
  try {
    highlightedHtml = highlighter.codeToHtml(rawContent, {
      lang: language,
      theme: 'blueprint',
      transformers: [
        {
          name: 'add-language-class',
          code(node) {
            this.addClassToHast(node, `language-${language}`);
            return node;
          },
        },
      ],
    });
    highlightedHtml = linkifyCodeHtml(highlightedHtml);
  } catch {
    // Fallback: wrap in pre/code
    highlightedHtml = `<pre><code>${escapeHtml(rawContent)}</code></pre>`;
  }

  return new SiteExampleFile({
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    raw: file.raw,
    parsed: file.parsed,
    hunks: file.hunks,
    language,
    highlightedHtml,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Dogfoods the functional-examples scanner to load all examples
 * from the project's root config.
 */
export interface LoadExamplesResult {
  siteExamples: SiteExample[];
  scannedExamples: ScannedExample[];
}

export async function loadExamples(): Promise<LoadExamplesResult> {
  // During vike build/dev, CWD is the docs-site directory.
  // The workspace root config is one level up.
  const workspaceRoot = resolve(process.cwd(), '..');
  const configPath = await findConfigFile(workspaceRoot);
  if (!configPath) {
    console.warn('[docs-site] No functional-examples config found');
    return { siteExamples: [], scannedExamples: [] };
  }

  const rawConfig = await loadConfig(configPath);
  const resolved = await resolveConfig(rawConfig);
  const result = await scanExamples(resolved);

  console.log(
    `[docs-site] Scanned ${result.stats.examplesFound} examples in ${result.stats.durationMs}ms`
  );

  if (result.errors.length > 0) {
    console.warn(
      `[docs-site] ${result.errors.length} scan errors:`,
      result.errors.map((e) => e.message)
    );
  }

  const highlighter = await getHighlighter();
  const examples: SiteExample[] = [];

  for (const ex of result.examples) {
    const files = await Promise.all(
      ex.files.map((f) => transformFile(f, highlighter))
    );

    const metadata = (ex.metadata ?? {}) as Record<string, unknown>;
    const tags = Array.isArray(metadata.tags)
      ? (metadata.tags as string[])
      : [];

    // Render prose files (README.md) through the documentation engine
    let renderedProseHtml: string | null = null;
    let proseBlocks: ProseBlock[] | null = null;
    try {
      const { renderedProse } = renderProseFiles(ex.files, metadata);
      if (renderedProse.length > 0) {
        const proseMarkdown = renderedProse.join('\n\n');
        renderedProseHtml = await renderMarkdown(proseMarkdown);
        proseBlocks = await parseProseToBlocks(
          proseMarkdown,
          ex.files,
          metadata
        );
      }
    } catch (err) {
      throw new Error(
        `[docs-site] Prose rendering failed for "${ex.id}": ${
          (err as Error).message
        }`,
        { cause: err }
      );
    }

    examples.push(
      new SiteExample({
        id: ex.id,
        title: ex.title,
        description: ex.description,
        extractorName: ex.extractorName,
        displayPath: ex.displayPath,
        rootPath: ex.rootPath,
        files,
        metadata: metadata as { tags: string[] } & Record<string, unknown>,
        hasReadme: files.some(
          (f) => f.relativePath.toLowerCase() === 'readme.md'
        ),
        tags,
        renderedProseHtml,
        proseBlocks,
      })
    );
  }

  return { siteExamples: examples, scannedExamples: result.examples };
}
