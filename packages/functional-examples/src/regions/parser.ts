/**
 * Region parsing implementation
 */

import type { RegionMap, RegionOptions } from './types.js';
import { getLanguageConfig } from './languages.js';

/**
 * Create regex patterns for region markers based on comment syntax
 */
function createRegionPatterns(
  lineComment?: string,
  blockComment?: [string, string]
): { start: RegExp; end: RegExp } {
  const patterns: string[] = [];

  // Line comment pattern: // #region name
  if (lineComment) {
    const escaped = escapeRegex(lineComment);
    patterns.push(`^\\s*${escaped}\\s*#region\\s+(\\S+)\\s*$`);
  }

  // Block comment pattern: <!-- #region name -->
  if (blockComment) {
    const [start, end] = blockComment.map(escapeRegex);
    patterns.push(`^\\s*${start}\\s*#region\\s+(\\S+)\\s*${end}\\s*$`);
  }

  // Combine patterns
  const startPattern = patterns.length > 0
    ? new RegExp(patterns.join('|'))
    : /^\s*\/\/\s*#region\s+(\S+)\s*$/;

  // Create end patterns similarly
  const endPatterns: string[] = [];

  if (lineComment) {
    const escaped = escapeRegex(lineComment);
    endPatterns.push(`^\\s*${escaped}\\s*#endregion\\s+(\\S+)\\s*$`);
  }

  if (blockComment) {
    const [start, end] = blockComment.map(escapeRegex);
    endPatterns.push(`^\\s*${start}\\s*#endregion\\s+(\\S+)\\s*${end}\\s*$`);
  }

  const endPattern = endPatterns.length > 0
    ? new RegExp(endPatterns.join('|'))
    : /^\s*\/\/\s*#endregion\s+(\S+)\s*$/;

  return { start: startPattern, end: endPattern };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the region ID from a match result.
 * Handles multiple capture groups from combined patterns.
 */
function extractRegionId(match: RegExpMatchArray): string {
  // Find the first non-undefined capture group
  for (let i = 1; i < match.length; i++) {
    if (match[i] !== undefined) {
      return match[i];
    }
  }
  throw new Error('No region ID captured');
}

/**
 * Parse all #region/#endregion pairs from code.
 * Supports nested regions and language-specific comment syntax.
 *
 * @param code - The source code to parse
 * @param options - Options including file extension for language detection
 * @returns Map of region IDs to their content
 * @throws Error on unclosed or mismatched regions
 *
 * @example
 * ```typescript
 * const regions = parseRegions(tsCode, { extension: 'ts' });
 * const setupCode = regions['setup']?.content;
 * ```
 */
export function parseRegions(code: string, options: RegionOptions = {}): RegionMap {
  const config = getLanguageConfig(options.extension ?? 'ts');
  const { start: REGION_START, end: REGION_END } = createRegionPatterns(
    config.lineComment,
    config.blockComment
  );

  const lines = code.split('\n');
  const regions: RegionMap = {};
  const stack: Array<{ id: string; startLine: number; startIndex: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const startMatch = line.match(REGION_START);
    if (startMatch) {
      const id = extractRegionId(startMatch);
      stack.push({ id, startLine: i + 1, startIndex: i });
      continue;
    }

    const endMatch = line.match(REGION_END);
    if (endMatch) {
      const endId = extractRegionId(endMatch);
      const openRegion = stack.pop();

      if (!openRegion) {
        throw new Error(`Unexpected #endregion '${endId}' at line ${i + 1}`);
      }

      if (openRegion.id !== endId) {
        throw new Error(
          `Mismatched region: opened '${openRegion.id}' at line ${openRegion.startLine}, closed '${endId}' at line ${i + 1}`
        );
      }

      // Extract content between markers (exclusive)
      const contentLines = lines.slice(openRegion.startIndex + 1, i);
      // Strip nested region markers from content
      const content = stripRegionMarkers(contentLines.join('\n'), options);

      regions[openRegion.id] = {
        startLine: openRegion.startLine,
        endLine: i + 1,
        content: content.trim(),
      };
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(
      `Unclosed region '${unclosed.id}' starting at line ${unclosed.startLine}`
    );
  }

  return regions;
}

/**
 * Extract a specific region's content by ID.
 *
 * @param code - The source code to parse
 * @param regionId - The ID of the region to extract
 * @param options - Options including file extension for language detection
 * @returns The region's content
 * @throws Error if region not found
 *
 * @example
 * ```typescript
 * const setupCode = extractRegion(code, 'setup', { extension: 'py' });
 * ```
 */
export function extractRegion(
  code: string,
  regionId: string,
  options: RegionOptions = {}
): string {
  const regions = parseRegions(code, options);

  if (!(regionId in regions)) {
    const available = Object.keys(regions);
    const hint = available.length > 0
      ? ` Available regions: ${available.join(', ')}`
      : ' No regions found in code.';
    throw new Error(`Region '${regionId}' not found.${hint}`);
  }

  return regions[regionId].content;
}

/**
 * Remove all region marker lines from code.
 *
 * @param code - The source code to clean
 * @param options - Options including file extension for language detection
 * @returns Code with all region markers removed
 *
 * @example
 * ```typescript
 * const cleanCode = stripRegionMarkers(code, { extension: 'ts' });
 * ```
 */
export function stripRegionMarkers(code: string, options: RegionOptions = {}): string {
  const config = getLanguageConfig(options.extension ?? 'ts');
  const { start: REGION_START, end: REGION_END } = createRegionPatterns(
    config.lineComment,
    config.blockComment
  );

  const lines = code.split('\n');
  const filtered = lines.filter(
    (line) => !REGION_START.test(line) && !REGION_END.test(line)
  );
  return filtered.join('\n');
}

/**
 * List all region IDs found in code.
 *
 * @param code - The source code to scan
 * @param options - Options including file extension for language detection
 * @returns Array of region IDs
 *
 * @example
 * ```typescript
 * const regionIds = listRegions(code, { extension: 'ts' });
 * // ['setup', 'main', 'cleanup']
 * ```
 */
export function listRegions(code: string, options: RegionOptions = {}): string[] {
  const regions = parseRegions(code, options);
  return Object.keys(regions);
}
