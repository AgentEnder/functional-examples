import type { CLI } from 'cli-forge';
import type { Plugin, ValidationResult } from '@functional-examples/devkit';
import { createDocumentationCommands } from './commands/index.js';
import { createMarkdownExtractor } from './extractor/extractor.js';
import type { DocsMetadataSchemaType, DocumentationPluginOptions } from './schema.js';
import {
  DOCS_METADATA_JSON_SCHEMA,
  DOCS_OPTIONS_JSON_SCHEMA,
  docsOptionsSchema,
  validateDocsMetadata,
} from './schema.js';

/**
 * Create the documentation plugin.
 *
 * @example
 * ```typescript
 * import { createDocumentationPlugin } from '@functional-examples/documentation';
 *
 * const config = {
 *   plugins: [
 *     createDocumentationPlugin({
 *       outputDir: './docs',
 *       format: 'markdown',
 *     }),
 *   ],
 * };
 * ```
 */
export function createDocumentationPlugin(
  options: DocumentationPluginOptions = {}
): Plugin<DocsMetadataSchemaType> {
  return {
    name: '@functional-examples/documentation',
    extensions: options.enableExtractor ? ['.md'] : undefined,
    extractor: options.enableExtractor ? createMarkdownExtractor() : undefined,
    schemas: {
      metadata: JSON.stringify(DOCS_METADATA_JSON_SCHEMA),
      options: JSON.stringify(DOCS_OPTIONS_JSON_SCHEMA),
    },
    validators: {
      metadata: validateDocsMetadata as (metadata: unknown) => ValidationResult,
    },
    commands: async (config) => {
      const resolved = docsOptionsSchema.parse(options);
      return createDocumentationCommands(config, resolved) as CLI[];
    },
    _options: options,
  };
}

// Re-export types for consumers
export type {
  DocumentationPluginOptions,
  DocsMetadata,
  ResolvedDocumentationPluginOptions,
  DocsMetadataSchemaType,
} from './schema.js';
export type {
  TemplateData,
  TemplateDescriptor,
  RenderedFile,
  IndexTemplateData,
  ProseRenderResult,
} from './templates/engine.js';
export type { TemplateHelpers } from './templates/helpers.js';
export type { ProseHelpers } from './templates/prose-helpers.js';
export { createMarkdownExtractor } from './extractor/extractor.js';
export {
  renderTemplate,
  buildTemplateData,
  renderProseFiles,
  loadTemplates,
  parseTemplateName,
  substituteVars,
  renderItemTemplate,
  renderIndexTemplate,
  getBuiltinTemplatesDir,
} from './templates/engine.js';
export { templateHelpers } from './templates/helpers.js';
export { ConsumptionTracker } from './templates/consumption-tracker.js';
export { createProseHelpers, fencedBlock } from './templates/prose-helpers.js';
export { createGuideRenderer } from './templates/guide-renderer.js';
export type { GuideRenderer, GuideRendererOptions, ExampleAccessor } from './templates/guide-renderer.js';
