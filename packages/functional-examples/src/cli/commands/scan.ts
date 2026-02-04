/**
 * Scan command - discover examples in a directory
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { cli } from 'cli-forge';
import { scanExamples } from '../../scanner/index.js';
import { resolveConfig } from '../../config/resolver.js';
import { findConfigFile, loadConfig } from '../../config/loader.js';
import type { Example } from '../../types/index.js';
import type { ScanResult } from '../../scanner/types.js';

export const scanCommand = cli('scan', {
  description: 'Scan a directory for code examples',
  builder: (cmd) =>
    cmd
      .positional('directory', {
        type: 'string',
        description: 'Directory to scan',
        required: true,
      })
      .option('config', {
        type: 'string',
        alias: ['c'],
        description: 'Path to config file',
      })
      .option('format', {
        type: 'string',
        alias: ['f'],
        description: 'Output format',
        choices: ['table', 'json', 'yaml'] as const,
        default: 'table' as const,
      })
      .option('output', {
        type: 'string',
        alias: ['o'],
        description: 'Write output to file',
      })
      .option('include', {
        type: 'array',
        items: 'string',
        description: 'Include pattern (can be repeated)',
        default: [] as string[],
      })
      .option('exclude', {
        type: 'array',
        items: 'string',
        description: 'Exclude pattern (can be repeated)',
        default: [] as string[],
      }),
  handler: async (options) => {
    const directory = options.directory ?? '.';
    const configPath = options.config ?? (await findConfigFile(directory));
    const rawConfig = configPath ? await loadConfig(configPath) : {};
    const config = await resolveConfig(rawConfig);

    if (config.extractors.length === 0) {
      console.error('No extractors available.');
      console.error('Install an extractor package:');
      console.error('  pnpm add @functional-examples/extractor-frontmatter');
      console.error('  pnpm add @functional-examples/yaml-manifest');
      process.exit(1);
    }

    const result = await scanExamples({
      root: path.resolve(directory),
      extractors: config.extractors,
      pathMappings: config.pathMappings,
      include:
        options.include.length > 0 ? options.include : config.scan.include,
      exclude:
        options.exclude.length > 0 ? options.exclude : config.scan.exclude,
    });

    const output = formatOutput(result, options.format);

    if (options.output) {
      await writeFile(options.output, output);
      console.log(`Results written to ${options.output}`);
    } else {
      console.log(output);
    }

    if (result.errors.length > 0) {
      process.exit(1);
    }
  },
});

function formatOutput(
  result: ScanResult,
  format: 'table' | 'json' | 'yaml'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(
        {
          examples: result.examples.map(serializeExample),
          errors: result.errors,
          stats: result.stats,
        },
        null,
        2
      );
    case 'yaml':
      return formatYaml(result);
    case 'table':
    default:
      return formatTable(result);
  }
}

function serializeExample(example: Example): Record<string, unknown> {
  return {
    id: example.id,
    title: example.title,
    description: example.description,
    rootPath: example.rootPath,
    files: example.files.map((f) => f.relativePath),
    extractorName: example.extractorName,
    metadata: example.metadata,
  };
}

function formatTable(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`Found ${result.examples.length} example(s)`);
  lines.push('');

  if (result.examples.length > 0) {
    lines.push(
      padRight('ID', 30) +
        padRight('Title', 40) +
        padRight('Files', 10) +
        'Extractor'
    );
    lines.push('-'.repeat(90));

    for (const example of result.examples) {
      lines.push(
        padRight(truncate(example.id, 28), 30) +
          padRight(truncate(example.title, 38), 40) +
          padRight(String(example.files.length), 10) +
          example.extractorName
      );
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push(`Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`  - ${error.path}: ${error.message}`);
    }
  }

  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push(`Conflicts (${result.conflicts.length}):`);
    for (const conflict of result.conflicts) {
      const status =
        conflict.resolution === 'path-mapping' ? '(resolved)' : '(ERROR)';
      lines.push(
        `  - ${conflict.filePath}: claimed by ${conflict.claimants.join(
          ', '
        )} ${status}`
      );
    }
  }

  lines.push('');
  lines.push(`Scan completed in ${result.stats.durationMs}ms`);

  return lines.join('\n');
}

function formatYaml(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('examples:');
  for (const example of result.examples) {
    lines.push(`  - id: ${example.id}`);
    lines.push(`    title: "${example.title}"`);
    if (example.description) {
      lines.push(`    description: "${example.description}"`);
    }
    lines.push(`    rootPath: ${example.rootPath}`);
    lines.push(`    extractor: ${example.extractorName}`);
    lines.push(`    files:`);
    for (const file of example.files) {
      lines.push(`      - ${file.relativePath}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('errors:');
    for (const error of result.errors) {
      lines.push(`  - path: ${error.path}`);
      lines.push(`    message: "${error.message}"`);
    }
  }

  lines.push('');
  lines.push('stats:');
  lines.push(`  examplesFound: ${result.stats.examplesFound}`);
  lines.push(`  filesClaimed: ${result.stats.filesClaimed}`);
  lines.push(`  durationMs: ${result.stats.durationMs}`);

  return lines.join('\n');
}

function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 2) + '..';
}
