// Context (high-level API)
export { createTypedocContext } from './context.js';
export type { TypedocContext, TypedocContextOptions } from './context.js';

// Deserialization
export { combineApiDocs, deserializeTypedocJson } from './deserialize.js';
export type { ApiExportWithTypeRef } from './deserialize.js';

// Navigation
export { buildApiNavigation } from './navigation.js';

// Type rendering
export { renderSignatureToHtml, renderTypeToHtml, typeToStringWithRanges } from './type-renderer.js';
export type { TypeRange, TypeStringResult } from './type-renderer.js';

// Shiki
export { tokenize, codeToHtml } from './shiki.js';
export type { BundledTheme } from './shiki.js';

// Markdown rendering
export { buildMarkdownProcessor, renderExportMarkdown } from './markdown.js';
export type { RenderedExportMarkdown } from './markdown.js';

// Utilities
export { slugify } from './utils.js';

// Types
export type {
  ApiComment,
  ApiDocs,
  ApiExport,
  ApiExportKind,
  ApiMethod,
  ApiModule,
  ApiPackage,
  ApiParameter,
  ApiProperty,
  ApiTypeParameter,
  LinkedApiExport,
  LinkedMethod,
  LinkedParameter,
  LinkedProperty,
  LinkedTypeParameter,
  NavigationItem,
} from './types.js';
