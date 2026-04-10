import type { Plugin, ValidationResult } from '@functional-examples/devkit';
import { createDocumentationCommands } from './commands/index.js';
import { createMarkdownExtractor } from './extractor/extractor.js';
import type {
  DocsMetadataSchemaType,
  DocumentationPluginOptions,
} from './schema.js';
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
      return createDocumentationCommands(config, resolved);
    },
    _options: options,
  };
}

// Re-export types for consumers
export { createMarkdownExtractor } from './extractor/extractor.js';
export type {
  DocsMetadata,
  DocsMetadataSchemaType,
  DocumentationPluginOptions,
  ResolvedDocumentationPluginOptions,
} from './schema.js';
export { ConsumptionTracker } from './templates/consumption-tracker.js';
export {
  buildTemplateData,
  getBuiltinTemplatesDir,
  loadTemplates,
  parseTemplateName,
  renderIndexTemplate,
  renderItemTemplate,
  renderProseFiles,
  renderTemplate,
  substituteVars,
} from './templates/engine.js';
export type {
  IndexTemplateData,
  ProseRenderResult,
  RenderedFile,
  TemplateData,
  TemplateDescriptor,
} from './templates/engine.js';
export { createGuideRenderer } from './templates/guide-renderer.js';
export type {
  ExampleAccessor,
  GuideRenderer,
  GuideRendererOptions,
} from './templates/guide-renderer.js';
export { createFileAccessor, templateHelpers } from './templates/helpers.js';
export type { FileAccessor, TemplateHelpers } from './templates/helpers.js';
export { createMetadataProxy } from './templates/metadata-proxy.js';
export { createProseHelpers } from './templates/prose-helpers.js';
export type { ProseHelpers } from './templates/prose-helpers.js';
