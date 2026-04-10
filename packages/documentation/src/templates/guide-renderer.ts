/**
 * Guide hydration renderer — expands example references in standalone
 * markdown guides that reference files/regions from *any* scanned example.
 *
 * Unlike prose helpers (scoped to a single example), the guide renderer
 * creates a cross-example lookup so authors can write:
 *
 * ```markdown
 * <%= example('basic-usage').file('scan.ts') %>
 * <%= example('basic-usage').region('config-setup') %>
 * ```
 */

import type { ExampleFile, ScannedExample } from '@functional-examples/devkit';
import { Eta } from 'eta';
import * as fs from 'node:fs/promises';
import { codeBlock } from 'markdown-factory';
import {
  type FileAccessor,
  createFileAccessor,
  templateHelpers,
} from './helpers.js';
import { createMetadataProxy } from './metadata-proxy.js';

/**
 * A renderer that expands example references in guide markdown.
 */
export interface GuideRenderer {
  /** Render a markdown string, expanding example references. */
  render(markdown: string): string;
  /** Read a markdown file and render it, expanding example references. */
  renderFile(filePath: string): Promise<string>;
}

/**
 * Scoped API returned by `example(id)` inside guide templates.
 */
export interface ExampleAccessor {
  /** Return a chainable FileAccessor for a file. */
  file(relativePath: string): FileAccessor;
  /** Render a region/hunk as a fenced code block (throws if ambiguous). */
  region(regionId: string): string;
  /** All files in the example. */
  files: ExampleFile[];
  /** The example's metadata. */
  metadata: Record<string, unknown>;
  /** The example's title. */
  title: string;
  /** The example's description. */
  description?: string;
}

/**
 * Options for createGuideRenderer.
 */
export interface GuideRendererOptions {
  /**
   * Additional helper functions exposed in guide templates by their key name.
   * Each key becomes a variable available directly in the template:
   * `<%= myHelper('arg') %>`
   */
  customHelpers?: Record<string, unknown>;
}

/**
 * Create a guide renderer bound to a set of scanned examples.
 *
 * Guide templates can reference any example by ID:
 * ```markdown
 * <%= example('basic-usage').file('scan.ts') %>
 * ```
 *
 * @example
 * ```typescript
 * import { createGuideRenderer } from '@functional-examples/documentation';
 * import { scan } from 'functional-examples';
 *
 * const { examples } = await scan({ root: workspaceRoot });
 * const renderer = createGuideRenderer(examples);
 * const html = await renderer.renderFile('docs/guides/getting-started.md');
 * ```
 */
export function createGuideRenderer(
  examples: ScannedExample[],
  options: GuideRendererOptions = {}
): GuideRenderer {
  // Build lookup map: example ID → ScannedExample
  const examplesById = new Map(examples.map((ex) => [ex.id, ex]));

  /**
   * Create a scoped accessor for a single example.
   */
  function exampleAccessor(id: string): ExampleAccessor {
    const ex = examplesById.get(id);
    if (!ex) {
      const available = [...examplesById.keys()].join(', ');
      throw new Error(
        `Guide helper example(): no example found with id "${id}". Available: ${available}`
      );
    }

    return {
      file(relativePath: string): FileAccessor {
        const found = ex.files.find((f) => f.relativePath === relativePath);
        if (!found) {
          const fileList = ex.files.map((f) => f.relativePath).join(', ');
          throw new Error(
            `Guide helper example('${id}').file(): no file "${relativePath}". Available: ${fileList}`
          );
        }
        return createFileAccessor(found, relativePath);
      },

      region(regionId: string): string {
        const match = templateHelpers.region(ex.files, regionId);
        if (!match) {
          throw new Error(
            `Guide helper example('${id}').region(): no region "${regionId}" found`
          );
        }
        const lang = templateHelpers.langFromPath(match.file.relativePath);
        return codeBlock(match.content, lang, { title: `${match.file.relativePath}#${regionId}` });
      },

      files: ex.files,
      metadata: createMetadataProxy(
        ex.metadata as Record<string, unknown>,
        `example('${id}').metadata`
      ),
      title: ex.title,
      description: ex.description,
    };
  }

  const { customHelpers = {} } = options;
  const customVarBindings = Object.keys(customHelpers)
    .map((k) => `var ${k} = it.custom.${k};`)
    .join(' ');

  // Separate Eta instance for guide templates with injected helper names
  const guideEta = new Eta({
    autoEscape: false,
    autoTrim: false,
    functionHeader: `var example = it.example, examples = it.examples, helpers = it.helpers; ${customVarBindings}`,
  });

  function render(markdown: string): string {
    return guideEta
      .renderString(markdown, {
        example: exampleAccessor,
        examples,
        helpers: templateHelpers,
        custom: customHelpers,
      })
      .replaceAll('\\%', '%');
  }

  async function renderFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return render(content);
  }

  return { render, renderFile };
}
