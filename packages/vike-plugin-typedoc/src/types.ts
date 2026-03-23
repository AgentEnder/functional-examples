/**
 * Full API documentation structure combining multiple packages.
 */
export interface ApiDocs {
  packages: Record<string, ApiPackage>;
  allExports: ApiExport[];
}

/**
 * Parsed API package from TypeDoc JSON.
 */
export interface ApiPackage {
  /** NPM package name */
  name: string;
  /** URL-safe slug (directory name) */
  slug: string;
  /** Modules within the package (sub-entries) */
  modules: ApiModule[];
  /** All exports across all modules */
  exports: ApiExport[];
}

/**
 * A module within a package (e.g., a sub-entry point).
 */
export interface ApiModule {
  name: string;
  exports: ApiExport[];
}

/**
 * A single exported symbol (function, type, interface, etc.).
 */
export interface ApiExport {
  name: string;
  /** kebab-case slug for URLs */
  slug: string;
  /** Full URL path, e.g. /api/devkit/create-matcher */
  path: string;
  /** Parent package slug */
  package: string;
  kind: ApiExportKind;
  /** True if this symbol is re-exported from another package */
  isReExport?: boolean;
  signature?: string;
  description?: string;
  comment?: ApiComment;
  parameters?: ApiParameter[];
  returnType?: string;
  typeParameters?: ApiTypeParameter[];
  properties?: ApiProperty[];
  methods?: ApiMethod[];
  category?: string;
}

export type ApiExportKind =
  | 'function'
  | 'type'
  | 'interface'
  | 'class'
  | 'variable'
  | 'enum';

export interface ApiComment {
  summary?: string;
  remarks?: string;
  examples?: string[];
  see?: string[];
  deprecated?: string;
}

export interface ApiParameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface ApiTypeParameter {
  name: string;
  constraint?: string;
  default?: string;
}

export interface ApiProperty {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  readonly?: boolean;
}

export interface ApiMethod {
  name: string;
  signature: string;
  description?: string;
  parameters?: ApiParameter[];
  returnType?: string;
}

export interface NavigationItem {
  title: string;
  path?: string;
  order?: number;
  children?: NavigationItem[];
}

// ============================================================================
// Linked type variants — extend the base types with `*Html` fields
// ============================================================================

export interface LinkedParameter extends ApiParameter {
  typeHtml: string;
}

export interface LinkedProperty extends ApiProperty {
  typeHtml: string;
}

export interface LinkedTypeParameter extends ApiTypeParameter {
  constraintHtml?: string;
  defaultHtml?: string;
}

export interface LinkedMethod extends ApiMethod {
  signatureHtml: string;
  returnTypeHtml?: string;
  parameters?: LinkedParameter[];
}

export interface LinkedApiExport extends ApiExport {
  /** Full signature with type references linked (e.g. function names, return types) */
  signatureHtml?: string;
  /** Signature rendered as a syntax-highlighted code block (from type-renderer pipeline) */
  signatureCodeHtml?: string;
  returnTypeHtml?: string;
  /** Return type rendered as a syntax-highlighted code block (from markdown pipeline) */
  returnTypeCodeHtml?: string;
  parameters?: LinkedParameter[];
  properties?: LinkedProperty[];
  typeParameters?: LinkedTypeParameter[];
  methods?: LinkedMethod[];

  /** Pre-rendered HTML from comment.summary / description (markdown) */
  descriptionHtml?: string;
  /** Pre-rendered HTML from comment.remarks (markdown) */
  remarksHtml?: string;
  /** Pre-rendered HTML for each example (wrapped in code fences, syntax-highlighted) */
  examplesHtml?: string[];
}
