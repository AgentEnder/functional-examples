/**
 * Custom TOML-based extractor example.
 *
 * This demonstrates how to create your own extractor that:
 * 1. Scans for a specific file pattern (meta.toml)
 * 2. Parses metadata from that file format
 * 3. Claims files and returns Example objects
 */
import {
  ExampleFile,
  type Example,
  type Extractor,
  type ExtractorResult,
} from 'functional-examples';
import { readdirSync, type Dirent } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path, { join } from 'node:path';

/**
 * Metadata structure for TOML examples.
 * You can define any shape that fits your use case.
 */
export interface TomlMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
  [key: string]: unknown;
}

/**
 * Create a custom extractor that reads TOML metadata files.
 *
 * Extractors implement a candidate-based pattern: they're called with
 * pre-filtered candidates (files and directories) and decide which to handle.
 */
// #_region createExtractor
export function createTomlExtractor(): Extractor<TomlMetadata> {
  return {
    name: 'toml-extractor',

    async extract(
      candidates: Dirent[]
    ): Promise<ExtractorResult<TomlMetadata>> {
      const examples: Example<TomlMetadata>[] = [];
      const claimedFiles = new Set<string>();
      const errors: { path: string; message: string }[] = [];

      // Find meta.toml files from candidates
      const tomlFiles: string[] = [];

      for (const candidate of candidates) {
        const fullPath = path.join(candidate.parentPath, candidate.name);

        if (candidate.isFile()) {
          // Direct file candidate: check if it's a meta.toml
          if (candidate.name === 'meta.toml') {
            tomlFiles.push(fullPath);
          }
        } else if (candidate.isDirectory()) {
          // Directory candidate: look for meta.toml inside
          const metaPath = path.join(fullPath, 'meta.toml');
          try {
            await readFile(metaPath, 'utf-8');
            tomlFiles.push(metaPath);
          } catch {
            // No meta.toml in this directory, skip
          }
        }
      }

      for (const tomlFile of tomlFiles) {
        try {
          const content = await readFile(tomlFile, 'utf-8');
          const metadata = parseSimpleToml(content);

          const exampleDir = path.dirname(tomlFile);

          // Collect all files in the example directory
          const files = collectExampleFiles(exampleDir);

          // Claim all files
          for (const file of files) {
            claimedFiles.add(file);
          }

          examples.push({
            id: metadata.id,
            title: metadata.title,
            description: metadata.description,
            rootPath: exampleDir,
            files: files.map((f) => new ExampleFile({
              absolutePath: f,
              relativePath: path.relative(exampleDir, f),
            })),
            metadata,
            extractorName: 'toml-extractor',
          });
        } catch (err) {
          errors.push({
            path: tomlFile,
            message: `Failed to parse: ${(err as Error).message}`,
          });
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
// #_endregion createExtractor

/**
 * Simplified TOML parser for demonstration.
 * In production, use a proper TOML library like @iarna/toml.
 */
function parseSimpleToml(content: string): TomlMetadata {
  const lines = content.split('\n');
  const result: Record<string, string> = {};

  for (const line of lines) {
    // Match: key = "value"
    const match = line.match(/^(\w+)\s*=\s*"(.*)"/);
    if (match) {
      result[match[1]] = match[2];
    }
  }

  if (!result['id'] || !result['title']) {
    throw new Error('TOML must have id and title fields');
  }

  return {
    id: result['id'],
    title: result['title'],
    description: result['description'],
    author: result['author'],
  };
}

function collectExampleFiles(root: string) {
  if (root.endsWith('node_modules')) {
    return [];
  }

  let files: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files = files.concat(
        collectExampleFiles(join(entry.parentPath, entry.name))
      );
    } else {
      files.push(join(entry.parentPath, entry.name));
    }
  }
  return files;
}
