import type { RegionConfig } from '@functional-examples/devkit';
import type { FileContentsParser, FileParseContext } from '../types/index.js';

/**
 * Create the initial parse context for a file.
 */
export function createInitialContext(
  filePath: string,
  raw: string,
  regionConfig: Required<Pick<RegionConfig, 'startTag' | 'endTag'>>,
  parsed?: string,
): FileParseContext {
  return {
    raw,
    parsed: parsed ?? raw,
    hunks: [],
    metadata: {},
    filePath,
    regionConfig,
  };
}

/**
 * Run file content through a parser pipeline.
 * Parsers execute in order, each receiving the output of the previous.
 *
 * Hunks are accumulated across parsers automatically. Each parser receives
 * an empty hunks array and only needs to return its own hunks. The pipeline
 * merges them in order so parsers don't need to preserve earlier hunks.
 */
export async function runParsePipeline(
  context: FileParseContext,
  parsers: FileContentsParser[]
): Promise<FileParseContext> {
  let result = context;

  for (const parser of parsers) {
    const accumulatedHunks = result.hunks ?? [];
    result = await parser.parse({ ...result, hunks: [] });
    result = {
      ...result,
      hunks: [...accumulatedHunks, ...(result.hunks ?? [])],
    };
  }

  return result;
}
