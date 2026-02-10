import type { ExampleFile } from '@functional-examples/devkit';
import { ConsumptionTracker } from './consumption-tracker.js';
import { templateHelpers } from './helpers.js';

/** Helpers injected into prose Eta templates as top-level variables. */
export interface ProseHelpers {
  /** Render a file as a fenced code block and mark it consumed. */
  file: (relativePath: string) => string;
  /** Render a region/hunk as a fenced code block and mark its file consumed. */
  region: (regionId: string) => string;
  /** All example files (read-only). */
  files: ExampleFile[];
  /** Standard template helpers (langFromPath, slugify, etc.). */
  helpers: typeof templateHelpers;
}

/**
 * Build a fenced code block string for a given language and content.
 */
export function fencedBlock(lang: string, content: string): string {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

/**
 * Create prose-template helpers bound to a specific set of files and tracker.
 *
 * These helpers are injected into Eta prose templates via `functionHeader`
 * so authors can write `<%= file('utils.ts') %>` instead of `<%= it.file('utils.ts') %>`.
 */
export function createProseHelpers(
  files: ExampleFile[],
  tracker: ConsumptionTracker
): ProseHelpers {
  return {
    file(relativePath: string): string {
      const found = files.find((f) => f.relativePath === relativePath);
      if (!found) {
        throw new Error(
          `Prose helper file(): no file found with relativePath "${relativePath}"`
        );
      }
      tracker.consume(relativePath);
      const lang = templateHelpers.langFromPath(relativePath);
      const content = found.parsed ?? found.raw ?? '';
      return fencedBlock(lang, content);
    },

    region(regionId: string): string {
      const match = templateHelpers.region(files, regionId);
      if (!match) {
        throw new Error(
          `Prose helper region(): no region found with id "${regionId}"`
        );
      }
      tracker.consume(match.file.relativePath);
      const lang = templateHelpers.langFromPath(match.file.relativePath);
      return fencedBlock(lang, match.content);
    },

    files,
    helpers: templateHelpers,
  };
}
