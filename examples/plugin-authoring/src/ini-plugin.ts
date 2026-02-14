/**
 * A minimal plugin that extracts examples from INI-based metadata files.
 *
 * This demonstrates the full Plugin interface:
 * - name: identifies the plugin
 * - extensions: file types this plugin handles
 * - extractor: discovers examples from candidates
 * - fileContentsParsers: transforms file content in the parse pipeline
 */
import type {
  Example,
  Extractor,
  ExtractorResult,
  FileContentsParser,
  FileParseContext,
  Plugin,
} from 'functional-examples';
import { readFile } from 'node:fs/promises';
import { readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';

// #_region metadata
/** Metadata shape for INI-based examples. */
export interface IniMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
}
// #_endregion metadata

// #_region parser
/** Parse simple INI key=value pairs. */
function parseIni(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    // Skip section headers
    if (trimmed.startsWith('[')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}
// #_endregion parser

// #_region extractor
/** Create an extractor that discovers meta.ini files. */
function createIniExtractor(): Extractor<IniMetadata> {
  return {
    name: 'ini-extractor',

    async extract(candidates: Dirent[]): Promise<ExtractorResult<IniMetadata>> {
      const examples: Example<IniMetadata>[] = [];
      const claimedFiles = new Set<string>();
      const errors: { path: string; message: string }[] = [];

      // Find meta.ini files from candidates
      const iniFiles: string[] = [];

      for (const candidate of candidates) {
        const fullPath = path.join(candidate.parentPath, candidate.name);

        if (candidate.isFile() && candidate.name === 'meta.ini') {
          iniFiles.push(fullPath);
        } else if (candidate.isDirectory()) {
          const metaPath = path.join(fullPath, 'meta.ini');
          try {
            await readFile(metaPath, 'utf-8');
            iniFiles.push(metaPath);
          } catch {
            // No meta.ini in this directory
          }
        }
      }

      for (const iniFile of iniFiles) {
        try {
          const content = await readFile(iniFile, 'utf-8');
          const parsed = parseIni(content);

          if (!parsed['id'] || !parsed['title']) {
            errors.push({ path: iniFile, message: 'meta.ini must have id and title' });
            continue;
          }

          const metadata: IniMetadata = {
            id: parsed['id'],
            title: parsed['title'],
            description: parsed['description'],
            author: parsed['author'],
          };

          const exampleDir = path.dirname(iniFile);
          const files = collectFiles(exampleDir);

          for (const f of files) claimedFiles.add(f);

          examples.push({
            id: metadata.id,
            title: metadata.title,
            description: metadata.description,
            rootPath: exampleDir,
            files: files.map((f) => ({
              absolutePath: f,
              relativePath: path.relative(exampleDir, f),
            })),
            metadata,
            extractorName: 'ini-extractor',
          });
        } catch (err) {
          errors.push({
            path: iniFile,
            message: `Failed to parse: ${(err as Error).message}`,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
// #_endregion extractor

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(entry.parentPath, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

// #_region content-parser
/** A file-contents parser that strips INI-style comments from .ini files. */
function createIniCommentStripper(): FileContentsParser {
  return {
    name: 'ini-comment-stripper',
    parse(context: FileParseContext): FileParseContext {
      if (!context.filePath?.endsWith('.ini')) return context;

      const stripped = context.parsed
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith(';') && !trimmed.startsWith('#');
        })
        .join('\n');

      return { ...context, parsed: stripped };
    },
  };
}
// #_endregion content-parser

// #_region create-plugin
/** Create the INI plugin. */
export function createIniPlugin(): Plugin<IniMetadata> {
  return {
    name: 'ini',
    extensions: ['.ini'],
    extractor: createIniExtractor(),
    fileContentsParsers: [createIniCommentStripper()],
  };
}
// #_endregion create-plugin
