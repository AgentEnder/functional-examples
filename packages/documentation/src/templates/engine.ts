import { Eta } from 'eta';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Example, ExampleFile } from '@functional-examples/devkit';
import { ConsumptionTracker } from './consumption-tracker.js';
import { isProseFile, templateHelpers, type TemplateHelpers } from './helpers.js';
import { createProseHelpers } from './prose-helpers.js';

/**
 * Template data model passed to Eta per-item templates as `it`.
 */
export interface TemplateData {
  /** Example unique identifier */
  id: string;
  /** Example title */
  title: string;
  /** Example description */
  description?: string;
  /** Full metadata object */
  metadata: Record<string, unknown>;
  /** Example files */
  files: ExampleFile[];
  /** Template helper functions */
  helpers: TemplateHelpers;
  /** Prose files rendered through Eta (with file/region helpers expanded) */
  renderedProse: string[];
  /** Files not consumed by prose helpers — the "remaining" code files */
  unconsumedFiles: ExampleFile[];
}

/** Data model for aggregate (index) templates. */
export interface IndexTemplateData {
  examples: { id: string; title: string; description?: string }[];
  format: string;
  helpers: TemplateHelpers;
}

/** Parsed template file descriptor. */
export interface TemplateDescriptor {
  /** Absolute path to the .template source file */
  sourcePath: string;
  /** Filename minus '.template', e.g. '@slug.md' */
  outputPattern: string;
  /** File extension, e.g. '.md' or '.mdoc' */
  format: string;
  /** Whether the filename contains an @var placeholder */
  perItem: boolean;
  /** Variable name (e.g. 'slug') when perItem is true */
  variable?: string;
  /** Raw Eta template content */
  content: string;
}

/** Rendered output ready to write. */
export interface RenderedFile {
  /** Relative path for the output file */
  relativePath: string;
  /** Rendered content */
  content: string;
}

/** Result of rendering prose files through Eta. */
export interface ProseRenderResult {
  /** Rendered prose content strings (one per prose file). */
  renderedProse: string[];
  /** Files not consumed by prose file/region helpers. */
  unconsumedFiles: ExampleFile[];
}

const eta = new Eta({ autoEscape: false, autoTrim: false });

/**
 * Separate Eta instance for prose files.
 * Uses `functionHeader` to inject short helper names into template scope
 * so authors write `<%= file('utils.ts') %>` instead of `<%= it.file('utils.ts') %>`.
 */
const proseEta = new Eta({
  autoEscape: false,
  autoTrim: false,
  functionHeader:
    'var file = it.file, region = it.region, files = it.files, metadata = it.metadata, helpers = it.helpers;',
});

/**
 * Render prose files through Eta, expanding `file()` and `region()` helpers,
 * and return which files remain unconsumed.
 */
export function renderProseFiles(
  files: ExampleFile[],
  metadata: Record<string, unknown>
): ProseRenderResult {
  const tracker = new ConsumptionTracker();
  const helpers = createProseHelpers(files, tracker, metadata);

  const proseFiles = files.filter(isProseFile);
  const renderedProse: string[] = [];

  // Prose files themselves are always consumed (they render inline)
  for (const pf of proseFiles) {
    tracker.consume(pf.relativePath);
  }

  for (const pf of proseFiles) {
    const content = pf.parsed ?? pf.raw ?? '';
    const rendered = proseEta.renderString(content, helpers);
    renderedProse.push(rendered);
  }

  return {
    renderedProse,
    unconsumedFiles: tracker.getUnconsumedFiles(files),
  };
}

/**
 * Build the template data model from an Example.
 */
export function buildTemplateData(example: Example): TemplateData {
  const metadata = example.metadata as Record<string, unknown>;
  const { renderedProse, unconsumedFiles } = renderProseFiles(
    example.files,
    metadata
  );

  return {
    id: example.id,
    title: example.title,
    description: example.description,
    metadata,
    files: example.files,
    helpers: templateHelpers,
    renderedProse,
    unconsumedFiles,
  };
}

/**
 * Resolve the built-in templates directory relative to this file.
 * At runtime, this file lives at `dist/templates/engine.js`.
 * The templates directory is at `packages/documentation/templates/`
 * — two levels up from `dist/templates/`.
 */
export function getBuiltinTemplatesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '../../templates');
}

/**
 * Parse a template's relative path into its descriptor fields.
 *
 * The `@var` convention can appear in any path segment — either in the
 * filename itself or in a directory name:
 * - `@slug.md.template` → variable `slug` (flat, filename)
 * - `examples/@example/index.md.template` → variable `example` (nested, directory)
 *
 * @param relativePath - Path relative to the templates root, e.g. `examples/@example/index.md.template`
 */
export function parseTemplateName(
  relativePath: string
): Pick<TemplateDescriptor, 'outputPattern' | 'format' | 'perItem' | 'variable'> {
  const outputPattern = relativePath.replace(/\.template$/, '');
  const format = path.extname(outputPattern);

  // Scan all path segments for an @-prefixed name
  const segments = outputPattern.split('/');
  let variable: string | undefined;

  for (const segment of segments) {
    if (segment.startsWith('@')) {
      // '@slug.md' → 'slug', '@example' → 'example'
      const ext = path.extname(segment);
      variable = ext ? segment.slice(1, -ext.length) : segment.slice(1);
      break;
    }
  }

  const perItem = variable !== undefined;

  const result: Pick<TemplateDescriptor, 'outputPattern' | 'format' | 'perItem' | 'variable'> = {
    outputPattern,
    format,
    perItem,
  };

  if (perItem) {
    result.variable = variable;
  }

  return result;
}

/**
 * Replace `@var` placeholders in a pattern with values from a vars map.
 *
 * Example: `substituteVars('@slug.md', { slug: 'getting-started' })` → `getting-started.md`
 */
export function substituteVars(
  pattern: string,
  vars: Record<string, string>
): string {
  let result = pattern;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(`@${key}`, value);
  }
  return result;
}

/**
 * Recursively collect all `.template` files under a directory.
 * Returns paths relative to `root`.
 */
async function collectTemplateFiles(
  root: string,
  current: string = root
): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectTemplateFiles(root, fullPath)));
    } else if (entry.name.endsWith('.template')) {
      results.push(path.relative(root, fullPath).replace(/\\/g, '/'));
    }
  }

  return results;
}

/**
 * Load all `.template` files from a directory (recursively) and parse their paths.
 *
 * Supports nested directory structures like:
 * ```
 * templates/
 *   index.md.template
 *   examples/@example/index.md.template
 * ```
 */
export async function loadTemplates(dir?: string): Promise<TemplateDescriptor[]> {
  const templatesDir = dir ?? getBuiltinTemplatesDir();
  const relativePaths = await collectTemplateFiles(templatesDir);

  const descriptors: TemplateDescriptor[] = [];

  for (const relPath of relativePaths) {
    const sourcePath = path.join(templatesDir, relPath);
    const content = await fs.readFile(sourcePath, 'utf-8');
    const parsed = parseTemplateName(relPath);

    descriptors.push({
      sourcePath,
      content,
      ...parsed,
    });
  }

  return descriptors;
}

/**
 * Render a per-item template for a single example.
 */
export async function renderItemTemplate(
  template: TemplateDescriptor,
  example: Example
): Promise<RenderedFile> {
  const data = buildTemplateData(example);
  const content = eta.renderString(template.content, data);

  const vars: Record<string, string> = {};
  if (template.variable) {
    vars[template.variable] = example.id;
  }
  const relativePath = substituteVars(template.outputPattern, vars);

  return { relativePath, content };
}

/**
 * Render an aggregate template with all examples.
 */
export async function renderIndexTemplate(
  template: TemplateDescriptor,
  examples: Example[]
): Promise<RenderedFile> {
  const data: IndexTemplateData = {
    examples: examples.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
    })),
    format: template.format,
    helpers: templateHelpers,
  };

  const content = eta.renderString(template.content, data);

  return { relativePath: template.outputPattern, content };
}

/**
 * Render an example using the default or a custom template file.
 *
 * @param example - The example to render
 * @param templatePath - Optional path to a custom .eta template file
 * @returns Rendered string
 */
export async function renderTemplate(
  example: Example,
  templatePath?: string
): Promise<string> {
  const data = buildTemplateData(example);

  if (templatePath) {
    const absPath = path.resolve(templatePath);
    const templateStr = await fs.readFile(absPath, 'utf-8');
    return eta.renderString(templateStr, data);
  }

  // Fall back to built-in markdown template
  const builtinDir = getBuiltinTemplatesDir();
  const defaultTemplate = path.join(builtinDir, '@slug.md.template');
  const templateStr = await fs.readFile(defaultTemplate, 'utf-8');
  return eta.renderString(templateStr, data);
}
