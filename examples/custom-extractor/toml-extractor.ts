/**
 * Custom TOML-based extractor example.
 *
 * This demonstrates how to create your own extractor that:
 * 1. Scans for a specific file pattern (meta.toml)
 * 2. Parses metadata from that file format
 * 3. Claims files and returns Example objects
 */
import {
  type Extractor,
  type ExtractorResult,
  type Example,
} from 'functional-examples';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Metadata structure for TOML examples.
 * You can define any shape that fits your use case.
 */
export interface TomlMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
}

/**
 * Create a custom extractor that reads TOML metadata files.
 *
 * Extractors implement the "tree-scan" pattern: they're called once
 * with the root directory and return ALL examples they find.
 */
export function createTomlExtractor(): Extractor<TomlMetadata> {
  return {
    name: 'toml-extractor',

    async extract(
      rootPath: string,
      options?: { include?: string[]; exclude?: string[] }
    ): Promise<ExtractorResult<TomlMetadata>> {
      const examples: Example<TomlMetadata>[] = [];
      const claimedFiles = new Set<string>();
      const errors: { path: string; message: string }[] = [];

      // Find all meta.toml files
      const tomlFiles = await fg('**/meta.toml', {
        cwd: rootPath,
        absolute: true,
        ignore: options?.exclude ?? ['**/node_modules/**'],
      });

      for (const tomlFile of tomlFiles) {
        try {
          const content = await readFile(tomlFile, 'utf-8');
          const metadata = parseSimpleToml(content);

          const exampleDir = path.dirname(tomlFile);

          // Collect all files in the example directory
          const files = await fg('**/*', {
            cwd: exampleDir,
            absolute: true,
            onlyFiles: true,
          });

          // Claim all files
          for (const file of files) {
            claimedFiles.add(file);
          }

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
