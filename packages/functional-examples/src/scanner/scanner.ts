/**
 * Core scanner that orchestrates multiple extractors
 */

import { minimatch } from 'minimatch';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createInitialContext, runParsePipeline } from '../plugins/pipeline.js';
import { validateExampleMetadata } from '../plugins/validation.js';
import { createSchemaValidator } from '../schema/validator.js';
import {
  DefaultMap,
  iter,
  type Example,
  type Extractor,
  type ExtractorError,
  type ExtractorResult,
  type ResolvedConfig,
  type ScannedExample,
} from '../types/index.js';
import { resolveCandidates } from './candidates.js';
import type { FileConflict, PathMapping, ScanResult } from './types.js';

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
 * import { resolveConfig, scanExamples } from 'functional-examples';
 *
 * const config = await resolveConfig({ root: './examples' });
 * const result = await scanExamples(config);
 *
 * for (const example of result.examples) {
 *   console.log(example.title);
 * }
 * ```
 */
export async function scanExamples<TMetadata = Record<string, unknown>>(
  config: ResolvedConfig<TMetadata>
): Promise<ScanResult<TMetadata>> {
  const startTime = Date.now();
  const {
    root: configRoot,
    pathMappings = [],
    registry,
    metadata: metadataSchema,
  } = config;
  const { include, exclude, root: scanRoot } = config.scan;
  const root = scanRoot ?? configRoot;

  // Resolve candidates from include/exclude patterns
  // Default to '*' if no include patterns specified (match direct children)
  const candidates = await resolveCandidates(
    root,
    include.length > 0 ? include : ['*'],
    exclude
  );

  const allExtractors = registry.getExtractors();

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
    }
  );

  // Step 2: Build file claim map (file -> [extractor names])
  const fileClaimMap = buildFileClaimMap(extractorResults);

  // Step 3: Detect and resolve conflicts
  const { conflicts, resolvedConflicts, unresolvedConflicts } =
    resolveConflicts(fileClaimMap, pathMappings, root);

  // Step 4: Filter examples based on conflict resolution
  const allExamples = extractorResults.flatMap((r) => r.examples);
  const filteredExamples = filterExamplesByConflicts(
    allExamples,
    unresolvedConflicts,
    resolvedConflicts
  );

  // Step 5: No post-extraction filtering - include/exclude only affect candidate resolution

  // Step 6: Convert to ScannedExample (compute displayPath)
  const scannedExamples: ScannedExample<TMetadata>[] = filteredExamples.map(
    (example) => ({
      ...example,
      displayPath: path.relative(root, example.rootPath) || '.',
      metadata: example.metadata as TMetadata,
    })
  );

  // Build lookup for examples by ID
  const examplesById = new Map(scannedExamples.map((ex) => [ex.id, ex]));

  // Step 7: Initialize error accumulator (displayPath -> source -> messages[])
  const errorsByPath = new DefaultMap<string, DefaultMap<string, string[]>>(
    () => new DefaultMap<string, string[]>(() => [])
  );

  // Helper to add errors to the accumulator
  const addError = (displayPath: string, source: string, message: string) => {
    errorsByPath.get(displayPath).get(source).push(message);
  };

  // Collect extractor errors
  for (const result of extractorResults) {
    for (const error of result.errors) {
      const displayPath = path.relative(root, error.path) || error.path;
      addError(displayPath, result.extractorName, error.message);
    }
  }

  // Collect unresolved conflict errors
  for (const conflict of unresolvedConflicts) {
    const displayPath = path.relative(root, conflict.filePath) || '.';
    addError(
      displayPath,
      'conflict',
      `File claimed by multiple extractors: ${conflict.claimants.join(
        ', '
      )}. Add a pathMapping to resolve.`
    );
  }

  // Step 8: Process file contents through parser pipelines
  for (const example of scannedExamples) {
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

  // Step 9: Run plugin metadata validators
  const metadataValidators = registry.getMetadataValidators();
  if (metadataValidators.length > 0) {
    const validationResult = validateExampleMetadata({
      validators: metadataValidators,
      examples: scannedExamples.map((e) => ({
        id: e.id,
        metadata: e.metadata as Record<string, unknown>,
      })),
    });

    for (const error of validationResult.errors) {
      const example = examplesById.get(error.exampleId);
      if (example) {
        addError(example.displayPath, error.pluginName, error.message);
      }
    }
  }

  // Step 10: Run config metadata schema validation (AJV)
  if (metadataSchema) {
    const validateSchema = createSchemaValidator(metadataSchema);

    for (const example of scannedExamples) {
      const result = validateSchema(example.metadata);
      if (!result.success) {
        for (const error of result.errors) {
          addError(
            example.displayPath,
            'config.metadata',
            `${error.path || '(root)'}: ${error.message}`
          );
        }
      }
    }
  }

  // Step 11: Flatten errors into final array
  const errors: ExtractorError[] = iter(errorsByPath.entries())
    .map(([displayPath, sourceErrors]) => ({
      path: displayPath,
      message: iter(sourceErrors.entries())
        .map(([source, msgs]) =>
          iter(msgs)
            .map((msg) => `    ${msg}`)
            .prefix([`  [${source}]:`])
        )
        .flat()
        .join('\n'),
    }))
    .collect();
  // for (const [displayPath, sourceErrors] of errorsByPath.entries()) {
  //   const lines: string[] = [];
  //   for (const [source, msgs] of sourceErrors.entries()) {
  //     lines.push(`  [${source}]:`);
  //     for (const msg of msgs) {
  //       lines.push(`    ${msg}`);
  //     }
  //   }
  //   errors.push({ path: displayPath, message: lines.join('\n') });
  // }

  return {
    examples: scannedExamples,
    errors,
    conflicts,
    stats: {
      filesClaimed: fileClaimMap.size,
      examplesFound: scannedExamples.length,
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
  options: { rootPath: string; exclude?: string[] }
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
  pathMappings: PathMapping[],
  root: string
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
    // Use relative path for matching since pathMapping patterns are relative to root
    const relativePath = path.relative(root, filePath);
    let resolved = false;

    for (const mapping of pathMappings) {
      if (minimatch(relativePath, mapping.pattern)) {
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
