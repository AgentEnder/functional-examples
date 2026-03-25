import type { ExampleFile } from '@functional-examples/devkit';
import { codeBlock } from 'markdown-factory';
import { ConsumptionTracker } from './consumption-tracker.js';
import {
  type FileAccessor,
  createFileAccessor,
  templateHelpers,
} from './helpers.js';

/** Helpers injected into prose Eta templates as top-level variables. */
export interface ProseHelpers {
  /** Return a chainable FileAccessor for a file, marking it consumed. */
  file: (relativePath: string) => FileAccessor;
  /** Render a region/hunk as a fenced code block and mark its file consumed. */
  region: (regionId: string) => string;
  /** All example files (read-only). */
  files: ExampleFile[];
  /** Standard template helpers (langFromPath, slugify, etc.). */
  helpers: typeof templateHelpers;
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
    file(relativePath: string): FileAccessor {
      const found = files.find((f) => f.relativePath === relativePath);
      if (!found) {
        throw new Error(
          `Prose helper file(): no file found with relativePath "${relativePath}"`
        );
      }
      tracker.consume(relativePath);
      // file() already marks consumed; no need to re-consume in region()
      return createFileAccessor(found, relativePath);
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
      return codeBlock(match.content, lang, { title: `${match.file.relativePath}#${regionId}` });
    },

    files,
    helpers: templateHelpers,
  };
}
