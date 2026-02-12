// Context (high-level API)
export { createTypedocContext } from './context.js';
export type { TypedocContext, TypedocContextOptions } from './context.js';

// Parser
export { combineApiDocs, parseTypedocJson } from './parser.js';

// Navigation
export { buildApiNavigation } from './navigation.js';

// Symbols map builder (for rehype-typedoc integration)
export { buildSymbolsMap } from './symbols.js';

// Type linkification
export { linkifyApiExport, linkifyType } from './linkify.js';
export type {
  LinkedApiExport,
  LinkedMethod,
  LinkedParameter,
  LinkedProperty,
  LinkedTypeParameter,
} from './linkify.js';

// Markdown rendering
export { buildMarkdownProcessor, renderExportMarkdown } from './markdown.js';
export type { RenderedExportMarkdown } from './markdown.js';

// Utilities
export { slugify, typeToString } from './utils.js';

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
  NavigationItem,
} from './types.js';
