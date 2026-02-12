import type { RehypeTypedocSymbol, SymbolEntry } from 'rehype-typedoc';
import type {
  ApiExport,
  ApiMethod,
  ApiParameter,
  ApiProperty,
  ApiTypeParameter,
} from './types.js';

/**
 * Regex that splits a type string into identifier tokens and everything else.
 * Identifiers: sequences of word characters starting with a letter or underscore.
 * Punctuation: everything between identifiers (brackets, pipes, spaces, etc.)
 */
const TOKEN_RE = /([a-zA-Z_$][a-zA-Z0-9_$]*)|([^a-zA-Z_$]+)/g;

/** Intrinsic types and keywords that should never be linked */
const SKIP_TOKENS = new Set([
  'string', 'number', 'boolean', 'void', 'undefined', 'null',
  'never', 'unknown', 'any', 'object', 'symbol', 'bigint',
  'true', 'false', 'this', 'typeof', 'keyof', 'readonly',
  'extends', 'infer', 'new', 'key', 'in', 'out', 'is',
  'function', 'class', 'interface', 'type', 'enum', 'const',
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolve a symbol entry, filtering out re-exports.
 * Returns the resolved symbol or undefined if ambiguous/not found.
 */
function resolveEntry(
  entry: SymbolEntry
): RehypeTypedocSymbol | undefined {
  if (!Array.isArray(entry)) return entry;
  const defs = entry.filter((s) => !s.isReExport);
  if (defs.length === 1) return defs[0];
  return undefined;
}

/**
 * Convert a type string to HTML with known symbols wrapped in `<a>` tags.
 *
 * Tokenizes the type string on identifier boundaries, looks up each identifier
 * in the symbols map, and wraps matches in links. Intrinsic types and
 * keywords are never linked.
 */
export function linkifyType(
  typeStr: string,
  symbols: Map<string, SymbolEntry>,
  buildLink: (symbol: RehypeTypedocSymbol) => string | undefined
): string {
  let result = '';

  for (const match of typeStr.matchAll(TOKEN_RE)) {
    const identifier = match[1];
    const punctuation = match[2];

    if (punctuation) {
      result += escapeHtml(punctuation);
      continue;
    }

    if (!identifier || SKIP_TOKENS.has(identifier)) {
      result += escapeHtml(identifier);
      continue;
    }

    const entry = symbols.get(identifier);
    if (!entry) {
      result += escapeHtml(identifier);
      continue;
    }

    const resolved = resolveEntry(entry);
    if (!resolved) {
      result += escapeHtml(identifier);
      continue;
    }

    const href = buildLink(resolved);
    if (!href) {
      result += escapeHtml(identifier);
      continue;
    }

    result += `<a href="${escapeHtml(href)}" class="typedoc-link">${escapeHtml(identifier)}</a>`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Linked type variants — extend the base types with `*Html` fields
// ---------------------------------------------------------------------------

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
  /** Signature rendered as a syntax-highlighted code block (from markdown pipeline) */
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

type LinkifyFn = (typeStr: string) => string;

/**
 * Process an ApiExport, converting all type string fields to HTML
 * with linked symbol references. Returns a new object with `*Html`
 * fields for each type string.
 */
export function linkifyApiExport(
  exp: ApiExport,
  linkify: LinkifyFn
): LinkedApiExport {
  const linked = { ...exp } as LinkedApiExport;

  if (exp.signature) {
    linked.signatureHtml = linkify(exp.signature);
  }

  if (exp.returnType) {
    linked.returnTypeHtml = linkify(exp.returnType);
  }

  if (exp.parameters) {
    linked.parameters = exp.parameters.map((p) => ({
      ...p,
      typeHtml: linkify(p.type),
    }));
  }

  if (exp.properties) {
    linked.properties = exp.properties.map((p) => ({
      ...p,
      typeHtml: linkify(p.type),
    }));
  }

  if (exp.typeParameters) {
    linked.typeParameters = exp.typeParameters.map((tp) => ({
      ...tp,
      constraintHtml: tp.constraint ? linkify(tp.constraint) : undefined,
      defaultHtml: tp.default ? linkify(tp.default) : undefined,
    }));
  }

  if (exp.methods) {
    linked.methods = exp.methods.map((m) => ({
      ...m,
      signatureHtml: linkify(m.signature),
      returnTypeHtml: m.returnType ? linkify(m.returnType) : undefined,
      parameters: m.parameters?.map((p) => ({
        ...p,
        typeHtml: linkify(p.type),
      })),
    }));
  }

  return linked;
}
