import type { FileContentsParser, FileParseContext } from '../types/index.js';

/**
 * Create the initial parse context for a file.
 */
export function createInitialContext(
  filePath: string,
  content: string
): FileParseContext {
  return {
    raw: content,
    parsed: content,
    hunks: [],
    metadata: {},
    filePath,
  };
}

/**
 * Run file content through a parser pipeline.
 * Parsers execute in order, each receiving the output of the previous.
 */
export async function runParsePipeline(
  context: FileParseContext,
  parsers: FileContentsParser[]
): Promise<FileParseContext> {
  let result = context;

  for (const parser of parsers) {
    result = await parser.parse(result);
  }

  return result;
}
