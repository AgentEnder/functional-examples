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
// TypeDoc JSON types (TypeDoc 2.0 schema)
// ============================================================================

export interface TypeDocJson {
  schemaVersion: string;
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: Record<string, unknown>;
  comment?: TypeDocComment;
  children?: TypeDocReflection[];
}

export interface TypeDocReflection {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  comment?: TypeDocComment;
  signatures?: TypeDocSignature[];
  children?: TypeDocReflection[];
  type?: TypeDocType;
  typeParameters?: TypeDocTypeParameter[];
  sources?: Array<{ fileName: string; line: number; character: number }>;
  extendedTypes?: TypeDocType[];
  implementedTypes?: TypeDocType[];
  inheritedFrom?: { type: string; target: number; name: string };
  defaultValue?: string;
}

export interface TypeDocFlags {
  isOptional?: boolean;
  isReadonly?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  isStatic?: boolean;
  isAbstract?: boolean;
}

export interface TypeDocComment {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{
    tag: string;
    content: Array<{ kind: string; text: string }>;
  }>;
}

export interface TypeDocSignature {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  comment?: TypeDocComment;
  parameters?: TypeDocParameter[];
  type?: TypeDocType;
  typeParameter?: TypeDocTypeParameter[];
}

export interface TypeDocParameter {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  type?: TypeDocType;
  comment?: TypeDocComment;
  defaultValue?: string;
}

export interface TypeDocTypeParameter {
  id: number;
  name: string;
  variant: string;
  kind: number;
  flags: TypeDocFlags;
  type?: TypeDocType;
  default?: TypeDocType;
}

export interface TypeDocType {
  type: string;
  name?: string;
  value?: unknown;
  types?: TypeDocType[];
  declaration?: TypeDocReflection;
  typeArguments?: TypeDocType[];
  target?: number | TypeDocType;
  elementType?: TypeDocType;
  package?: string;
  qualifiedName?: string;
  operator?: string;
  objectType?: TypeDocType;
  indexType?: TypeDocType;
  checkType?: TypeDocType;
  extendsType?: TypeDocType;
  trueType?: TypeDocType;
  falseType?: TypeDocType;
}

/** TypeDoc kind constants (TypeDoc 2.0) */
export const KIND = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
  Reference: 16777216,
} as const;
