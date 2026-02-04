// ---
// title: Custom Extractor
// description: Shows how to create and register a custom metadata extractor
// tags:
//   - advanced
//   - extensibility
// ---
import {
  scanExamples,
  type Extractor,
  type ExtractorResult,
  type Example,
} from 'functional-examples';
import { glob } from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// #region custom-extractor
/**
 * Example custom extractor that reads TOML metadata files.
 *
 * Extractors implement the tree-scan pattern: they're called once
 * with the root directory and return ALL examples they find.
 */
interface TomlMetadata {
  id: string;
  title: string;
  description?: string;
}

function createTomlExtractor(): Extractor<TomlMetadata> {
  return {
    name: 'toml',

    async extract(rootPath: string): Promise<ExtractorResult<TomlMetadata>> {
      const examples: Example<TomlMetadata>[] = [];
      const claimedFiles = new Set<string>();

      // Find all meta.toml files
      const tomlFiles = await glob('**/meta.toml', {
        cwd: rootPath,
        absolute: true,
      });

      for (const tomlFile of tomlFiles) {
        try {
          const content = await readFile(tomlFile, 'utf-8');
          // In real code, you'd parse TOML properly
          const metadata = parseToml(content);

          const exampleDir = path.dirname(tomlFile);

          // Collect all files in the example directory
          const files = await glob('**/*', {
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
            extractorName: 'toml',
          });
        } catch {
          // Skip invalid files
        }
      }

      return { examples, errors: [], claimedFiles };
    },
  };
}

// Simplified TOML parser (use a real library in production)
function parseToml(content: string): TomlMetadata {
  const lines = content.split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^(\w+)\s*=\s*"(.*)"/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return {
    id: result['id'] ?? 'unknown',
    title: result['title'] ?? 'Untitled',
    description: result['description'],
  };
}
// #endregion custom-extractor

// #region usage
// Use your custom extractor with scanExamples
async function main() {
  const result = await scanExamples({
    root: './examples',
    extractors: [createTomlExtractor()],
  });

  console.log(`Found ${result.examples.length} TOML examples`);
}

void main;
// #endregion usage
