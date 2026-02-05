/**
 * Core scanner that orchestrates multiple extractors
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Dirent } from 'node:fs';
import { minimatch } from 'minimatch';
import type {
  Example,
  Extractor,
  ExtractorError,
  ExtractorResult,
  Plugin,
} from '../types/index.js';
import { PluginRegistry } from '../plugins/registry.js';
import { runParsePipeline, createInitialContext } from '../plugins/pipeline.js';
import { validateExampleMetadata } from '../plugins/validation.js';
import { createSchemaValidator } from '../schema/validator.js';
import type {
  FileConflict,
  PathMapping,
  ScanOptions,
  ScanResult,
} from './types.js';
import { resolveCandidates, getDefaultIncludePattern } from './candidates.js';

/**
 * Scan a directory for examples using the provided extractors.
 *
 * The scanner:
 * 1. Runs all extractors in parallel against the root
 * 2. Collects claimed files and detects conflicts
 * 3. Resolves conflicts via path mappings (or errors if unresolved)
 * 4. Applies include/exclude filters AFTER extraction
 * 5. Returns unified results
 *
 * @example
 * ```typescript
 * import { scanExamples } from 'functional-examples';
 * import { createFrontmatterExtractor } from '@functional-examples/extractor-frontmatter';
 *
 * const result = await scanExamples({
 *   root: './examples',
 *   extractors: [createFrontmatterExtractor()],
 * });
 *
 * for (const example of result.examples) {
 *   console.log(example.title);
 * }
 * ```
 */
export async function scanExamples<TMetadata = Record<string, unknown>>(
  options: ScanOptions<TMetadata>
): Promise<ScanResult<TMetadata>> {
  const startTime = Date.now();
  const {
    root,
    plugins = [],
    extractors: standaloneExtractors = [],
    pathMappings = [],
    include = ['**/*'],
    exclude = [],
    signal,
    processFileContents = true,
    metadataSchema,
  } = options;

  // Determine effective include pattern (smart default detection)
  const effectiveInclude =
    include.length > 0 && !(include.length === 1 && include[0] === '*')
      ? include
      : await getDefaultIncludePattern(root);

  // Resolve candidates from include/exclude patterns
  const candidates = await resolveCandidates(root, effectiveInclude, exclude);

  // Build plugin registry
  const registry = new PluginRegistry();
  for (const plugin of plugins as Plugin[]) {
    registry.register(plugin);
  }

  // Collect all extractors (from plugins + standalone for backward compat)
  const allExtractors = [
    ...registry.getExtractors(),
    ...standaloneExtractors,
  ] as Extractor<TMetadata>[];

  if (allExtractors.length === 0) {
    return {
      examples: [],
      errors: [
        {
          path: root,
          message: 'No extractors provided',
        },
      ],
      conflicts: [],
      stats: {
        filesClaimed: 0,
        examplesFound: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        durationMs: Date.now() - startTime,
      },
    };
  }

  // Step 1: Run all extractors in parallel
  const extractorResults = await runExtractorsInParallel(
    allExtractors,
    candidates,
    {
      rootPath: root,
      exclude,
      signal,
    }
  );

  // Step 2: Build file claim map (file -> [extractor names])
  const fileClaimMap = buildFileClaimMap(extractorResults);

  // Step 3: Detect and resolve conflicts
  const { conflicts, resolvedConflicts, unresolvedConflicts } =
    resolveConflicts(fileClaimMap, pathMappings);

  // Step 4: Filter examples based on conflict resolution
  const allExamples = extractorResults.flatMap((r) => r.examples);
  const filteredExamples = filterExamplesByConflicts(
    allExamples,
    unresolvedConflicts,
    resolvedConflicts
  );

  // Step 5: Apply include/exclude filters
  const finalExamples = applyFilters(filteredExamples, include, exclude);

  // Step 6: Collect all errors
  const errors: ExtractorError[] = [
    ...extractorResults.flatMap((r) => r.errors),
    ...unresolvedConflicts.map((c) => ({
      path: c.filePath,
      message: `File claimed by multiple extractors: ${c.claimants.join(
        ', '
      )}. Add a pathMapping to resolve.`,
    })),
  ];

  // Step 7: Process file contents through parser pipelines
  if (processFileContents) {
    for (const example of finalExamples) {
      for (const file of example.files) {
        const ext = path.extname(file.absolutePath);
        const parsers = registry.getParsersForExtension(ext);

        if (parsers.length > 0) {
          // Load file content if not already loaded
          if (file.raw === undefined) {
            file.raw = await fs.readFile(file.absolutePath, 'utf-8');
          }

          const ctx = createInitialContext(file.absolutePath, file.raw);
          const result = await runParsePipeline(ctx, parsers);
          file.parsed = result.parsed;
          file.hunks = result.hunks;
        }
      }
    }
  }

  // Step 8: Run plugin metadata validators
  const metadataValidators = registry.getMetadataValidators();
  if (metadataValidators.length > 0) {
    const validationResult = validateExampleMetadata({
      validators: metadataValidators,
      examples: finalExamples.map((e) => ({
        id: e.id,
        metadata: e.metadata as Record<string, unknown>,
      })),
    });

    // Convert validation errors to ExtractorErrors
    for (const error of validationResult.errors) {
      errors.push({
        path: `example:${error.exampleId}`,
        message: `[${error.pluginName}] ${error.path}: ${error.message}`,
      });
    }
  }

  // Step 9: Run config metadata schema validation (AJV)
  if (metadataSchema) {
    const validateSchema = createSchemaValidator(metadataSchema);

    for (const example of finalExamples) {
      const result = validateSchema(example.metadata);
      if (!result.success) {
        for (const error of result.errors) {
          errors.push({
            path: `example:${example.id}`,
            message: `[config.metadata] ${error.path || '(root)'}: ${error.message}`,
          });
        }
      }
    }
  }

  return {
    examples: finalExamples,
    errors,
    conflicts,
    stats: {
      filesClaimed: fileClaimMap.size,
      examplesFound: finalExamples.length,
      conflictsDetected: conflicts.length,
      conflictsResolved: resolvedConflicts.length,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Run all extractors in parallel
 */
async function runExtractorsInParallel<TMetadata>(
  extractors: Extractor<TMetadata>[],
  candidates: Dirent[],
  options: { rootPath: string; exclude?: string[]; signal?: AbortSignal }
): Promise<Array<ExtractorResult<TMetadata> & { extractorName: string }>> {
  const results = await Promise.all(
    extractors.map(async (extractor) => {
      try {
        const result = await extractor.extract(candidates, options);
        return { ...result, extractorName: extractor.name };
      } catch (error) {
        // Extractor threw unexpectedly - wrap as error result
        return {
          examples: [] as Example<TMetadata>[],
          errors: [
            {
              path: options.rootPath,
              message: `Extractor "${extractor.name}" failed: ${
                (error as Error).message
              }`,
              cause: error as Error,
            },
          ],
          claimedFiles: new Set<string>(),
          extractorName: extractor.name,
        };
      }
    })
  );

  return results;
}

/**
 * Build a map of file path -> extractor names that claimed it
 */
function buildFileClaimMap<TMetadata>(
  results: Array<ExtractorResult<TMetadata> & { extractorName: string }>
): Map<string, string[]> {
  const fileClaimMap = new Map<string, string[]>();

  for (const result of results) {
    for (const file of result.claimedFiles) {
      const existing = fileClaimMap.get(file) ?? [];
      existing.push(result.extractorName);
      fileClaimMap.set(file, existing);
    }
  }

  return fileClaimMap;
}

/**
 * Detect conflicts and attempt resolution via path mappings
 */
function resolveConflicts(
  fileClaimMap: Map<string, string[]>,
  pathMappings: PathMapping[]
): {
  conflicts: FileConflict[];
  resolvedConflicts: FileConflict[];
  unresolvedConflicts: FileConflict[];
} {
  const conflicts: FileConflict[] = [];
  const resolvedConflicts: FileConflict[] = [];
  const unresolvedConflicts: FileConflict[] = [];

  for (const [filePath, claimants] of fileClaimMap) {
    if (claimants.length <= 1) continue;

    // This is a conflict - try to resolve via path mappings
    let resolved = false;

    for (const mapping of pathMappings) {
      if (minimatch(filePath, mapping.pattern)) {
        if (claimants.includes(mapping.extractor)) {
          const conflict: FileConflict = {
            filePath,
            claimants,
            resolution: 'path-mapping',
            winner: mapping.extractor,
          };
          conflicts.push(conflict);
          resolvedConflicts.push(conflict);
          resolved = true;
          break;
        }
      }
    }

    if (!resolved) {
      const conflict: FileConflict = {
        filePath,
        claimants,
        resolution: 'error',
      };
      conflicts.push(conflict);
      unresolvedConflicts.push(conflict);
    }
  }

  return { conflicts, resolvedConflicts, unresolvedConflicts };
}

/**
 * Filter examples based on conflict resolution.
 * - Remove examples containing files from unresolved conflicts
 * - For resolved conflicts, keep only the winning extractor's examples
 */
function filterExamplesByConflicts<TMetadata>(
  examples: Example<TMetadata>[],
  unresolvedConflicts: FileConflict[],
  resolvedConflicts: FileConflict[]
): Example<TMetadata>[] {
  const unresolvedFiles = new Set(unresolvedConflicts.map((c) => c.filePath));

  // Build map of file -> winning extractor for resolved conflicts
  const winnerMap = new Map<string, string>();
  for (const conflict of resolvedConflicts) {
    if (conflict.winner) {
      winnerMap.set(conflict.filePath, conflict.winner);
    }
  }

  return examples.filter((example) => {
    // Check if any file in this example is part of an unresolved conflict
    const hasUnresolvedFile = example.files.some((f) =>
      unresolvedFiles.has(f.absolutePath)
    );
    if (hasUnresolvedFile) {
      return false;
    }

    // Check if any file in this example is part of a resolved conflict
    // where this extractor is NOT the winner
    for (const file of example.files) {
      const winner = winnerMap.get(file.absolutePath);
      if (winner && winner !== example.extractorName) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Apply include/exclude filters to examples based on their root path
 */
function applyFilters<TMetadata>(
  examples: Example<TMetadata>[],
  include: string[],
  exclude: string[]
): Example<TMetadata>[] {
  return examples.filter((example) => {
    // Check include patterns (at least one must match)
    const matchesInclude =
      include.length === 0 ||
      include.some((pattern) => minimatch(example.rootPath, pattern));

    if (!matchesInclude) {
      return false;
    }

    // Check exclude patterns (none must match)
    const matchesExclude = exclude.some((pattern) =>
      minimatch(example.rootPath, pattern)
    );

    return !matchesExclude;
  });
}
