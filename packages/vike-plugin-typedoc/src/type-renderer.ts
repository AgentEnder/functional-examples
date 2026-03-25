import type { BundledTheme } from 'shiki';
import type {
  DeclarationReflection,
  ParameterReflection,
  SignatureReflection,
  Type,
} from 'typedoc';
import {
  ArrayType,
  ConditionalType,
  IndexedAccessType,
  InferredType,
  IntersectionType,
  IntrinsicType,
  LiteralType,
  MappedType,
  NamedTupleMember,
  OptionalType,
  PredicateType,
  QueryType,
  ReferenceType,
  ReflectionType,
  RestType,
  TemplateLiteralType,
  TupleType,
  TypeOperatorType,
  UnionType,
} from 'typedoc';
import { tokenize } from './shiki.js';
import { isEmptyReflectionType } from './type-utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TypeRange {
  start: number;
  end: number;
  path: string;
}

export interface TypeStringResult {
  text: string;
  ranges: TypeRange[];
}

// ---------------------------------------------------------------------------
// String builder helper
// ---------------------------------------------------------------------------

class TypeStringBuilder {
  private parts: string[] = [];
  private offset = 0;
  readonly ranges: TypeRange[] = [];

  append(text: string): void {
    this.parts.push(text);
    this.offset += text.length;
  }

  appendWithRange(text: string, path: string): void {
    const start = this.offset;
    this.parts.push(text);
    this.offset += text.length;
    this.ranges.push({ start, end: this.offset, path });
  }

  get position(): number {
    return this.offset;
  }

  build(): TypeStringResult {
    return { text: this.parts.join(''), ranges: this.ranges };
  }
}

// ---------------------------------------------------------------------------
// Type walker
// ---------------------------------------------------------------------------

type ResolveUrl = (symbolName: string) => string | undefined;

function walkType(
  type: Type,
  builder: TypeStringBuilder,
  resolveUrl: ResolveUrl
): void {
  if (type instanceof IntrinsicType) {
    builder.append(type.name);
    return;
  }

  if (type instanceof LiteralType) {
    if (typeof type.value === 'string') {
      builder.append(`"${type.value}"`);
    } else if (type.value === null) {
      builder.append('null');
    } else if (typeof type.value === 'bigint') {
      builder.append(`${type.value}n`);
    } else {
      builder.append(String(type.value));
    }
    return;
  }

  if (type instanceof ReferenceType) {
    const name = type.name;
    const path = resolveUrl(name);
    if (path) {
      builder.appendWithRange(name, path);
    } else {
      builder.append(name);
    }
    if (type.typeArguments && type.typeArguments.length > 0) {
      builder.append('<');
      for (let i = 0; i < type.typeArguments.length; i++) {
        if (i > 0) builder.append(', ');
        walkType(type.typeArguments[i], builder, resolveUrl);
      }
      builder.append('>');
    }
    return;
  }

  if (type instanceof UnionType) {
    const members = type.types.filter((t) => !isEmptyReflectionType(t));
    if (members.length === 0) return;
    for (let i = 0; i < members.length; i++) {
      if (i > 0) builder.append(' | ');
      walkType(members[i], builder, resolveUrl);
    }
    return;
  }

  if (type instanceof IntersectionType) {
    const members = type.types.filter((t) => !isEmptyReflectionType(t));
    if (members.length === 0) return;
    for (let i = 0; i < members.length; i++) {
      if (i > 0) builder.append(' & ');
      walkType(members[i], builder, resolveUrl);
    }
    return;
  }

  if (type instanceof ArrayType) {
    const needsParens =
      type.elementType instanceof UnionType ||
      type.elementType instanceof IntersectionType;
    if (needsParens) builder.append('(');
    walkType(type.elementType, builder, resolveUrl);
    if (needsParens) builder.append(')');
    builder.append('[]');
    return;
  }

  if (type instanceof TupleType) {
    builder.append('[');
    if (type.elements) {
      for (let i = 0; i < type.elements.length; i++) {
        if (i > 0) builder.append(', ');
        walkType(type.elements[i], builder, resolveUrl);
      }
    }
    builder.append(']');
    return;
  }

  if (type instanceof NamedTupleMember) {
    builder.append(type.name);
    if (type.isOptional) builder.append('?');
    builder.append(': ');
    walkType(type.element, builder, resolveUrl);
    return;
  }

  if (type instanceof ConditionalType) {
    walkType(type.checkType, builder, resolveUrl);
    builder.append(' extends ');
    walkType(type.extendsType, builder, resolveUrl);
    builder.append(' ? ');
    walkType(type.trueType, builder, resolveUrl);
    builder.append(' : ');
    walkType(type.falseType, builder, resolveUrl);
    return;
  }

  if (type instanceof IndexedAccessType) {
    walkType(type.objectType, builder, resolveUrl);
    builder.append('[');
    walkType(type.indexType, builder, resolveUrl);
    builder.append(']');
    return;
  }

  if (type instanceof TypeOperatorType) {
    builder.append(type.operator + ' ');
    walkType(type.target, builder, resolveUrl);
    return;
  }

  if (type instanceof QueryType) {
    builder.append('typeof ');
    walkType(type.queryType, builder, resolveUrl);
    return;
  }

  if (type instanceof InferredType) {
    builder.append('infer ');
    builder.append(type.name);
    if (type.constraint) {
      builder.append(' extends ');
      walkType(type.constraint, builder, resolveUrl);
    }
    return;
  }

  if (type instanceof PredicateType) {
    builder.append(type.name);
    if (type.targetType) {
      builder.append(' is ');
      walkType(type.targetType, builder, resolveUrl);
    }
    return;
  }

  if (type instanceof RestType) {
    builder.append('...');
    walkType(type.elementType, builder, resolveUrl);
    return;
  }

  if (type instanceof OptionalType) {
    walkType(type.elementType, builder, resolveUrl);
    builder.append('?');
    return;
  }

  if (type instanceof MappedType) {
    builder.append('{ ');
    if (type.readonlyModifier === '+') builder.append('readonly ');
    else if (type.readonlyModifier === '-') builder.append('-readonly ');
    builder.append('[');
    builder.append(type.parameter);
    builder.append(' in ');
    if (type.parameterType) {
      walkType(type.parameterType, builder, resolveUrl);
    }
    if (type.nameType) {
      builder.append(' as ');
      walkType(type.nameType, builder, resolveUrl);
    }
    builder.append(']');
    if (type.optionalModifier === '+') builder.append('?');
    else if (type.optionalModifier === '-') builder.append('-?');
    builder.append(': ');
    if (type.templateType) {
      walkType(type.templateType, builder, resolveUrl);
    }
    builder.append(' }');
    return;
  }

  if (type instanceof TemplateLiteralType) {
    builder.append('`');
    builder.append(type.head);
    for (const tail of type.tail) {
      builder.append('${');
      walkType(tail[0], builder, resolveUrl);
      builder.append('}');
      builder.append(tail[1]);
    }
    builder.append('`');
    return;
  }

  if (type instanceof ReflectionType) {
    const decl = type.declaration;
    if (decl?.signatures && decl.signatures.length > 0) {
      walkFunctionSignature(decl.signatures[0], builder, resolveUrl);
      return;
    }
    if (decl?.children && decl.children.length > 0) {
      walkObjectLiteral(decl.children, builder, resolveUrl);
      return;
    }
    return;
  }

  // Fallback: use TypeDoc's toString for unknown types
  builder.append(type.toString());
}

function walkFunctionSignature(
  sig: SignatureReflection,
  builder: TypeStringBuilder,
  resolveUrl: ResolveUrl
): void {
  builder.append('(');
  const params: ParameterReflection[] = sig.parameters ?? [];
  for (let i = 0; i < params.length; i++) {
    if (i > 0) builder.append(', ');
    builder.append(params[i].name);
    if (params[i].flags?.isOptional) builder.append('?');
    builder.append(': ');
    const type = params[i].type;
    if (type) {
      walkType(type, builder, resolveUrl);
    } else {
      builder.append('any');
    }
  }
  builder.append(') => ');
  if (sig.type) {
    walkType(sig.type, builder, resolveUrl);
  } else {
    builder.append('void');
  }
}

function walkObjectLiteral(
  children: DeclarationReflection[],
  builder: TypeStringBuilder,
  resolveUrl: ResolveUrl
): void {
  builder.append('{ ');
  for (let i = 0; i < children.length; i++) {
    if (i > 0) builder.append('; ');
    const child = children[i];
    if (child.flags?.isReadonly) builder.append('readonly ');
    builder.append(child.name);
    if (child.flags?.isOptional) builder.append('?');
    builder.append(': ');
    if (child.type) {
      walkType(child.type, builder, resolveUrl);
    } else {
      builder.append('unknown');
    }
  }
  builder.append(' }');
}

// ---------------------------------------------------------------------------
// Public API: typeToStringWithRanges
// ---------------------------------------------------------------------------

/**
 * Walk a TypeDoc `Type` tree, producing a plain string representation
 * and a parallel array of ranges that map symbol names to URL paths.
 */
export function typeToStringWithRanges(
  type: Type,
  resolveUrl: ResolveUrl
): TypeStringResult {
  const builder = new TypeStringBuilder();
  walkType(type, builder, resolveUrl);
  return builder.build();
}

// ---------------------------------------------------------------------------
// Prettier formatting (optional)
// ---------------------------------------------------------------------------

async function formatWithPrettier(text: string): Promise<string | null> {
  try {
    // @ts-expect-error prettier is an optional dependency without type declarations
    const prettier = await import('prettier');
    const formatted = await prettier.format(text, {
      parser: 'typescript',
      semi: true,
    });
    // prettier adds a trailing newline — strip it
    return formatted.trimEnd();
  } catch {
    return null;
  }
}

/**
 * Remap ranges from the original text to a formatted version by scanning
 * for each symbol name in sequence.
 */
export function remapRanges(
  original: TypeStringResult,
  formatted: string
): TypeRange[] {
  const newRanges: TypeRange[] = [];
  let searchFrom = 0;

  for (const range of original.ranges) {
    const symbolName = original.text.slice(range.start, range.end);
    const idx = formatted.indexOf(symbolName, searchFrom);
    if (idx !== -1) {
      newRanges.push({
        start: idx,
        end: idx + symbolName.length,
        path: range.path,
      });
      searchFrom = idx + symbolName.length;
    }
  }

  return newRanges;
}

// ---------------------------------------------------------------------------
// HTML rendering helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Merge Shiki tokens with ranges to produce HTML.
 * Tokens that overlap a range are wrapped in `<a>` tags.
 */
async function mergeTokensAndRanges(
  code: string,
  ranges: TypeRange[],
  theme: BundledTheme = 'github-dark'
): Promise<string> {
  const { tokens: tokenLines } = await tokenize(code, theme);

  const lines: string[] = [];
  let globalOffset = 0;

  for (const lineTokens of tokenLines) {
    const spans: string[] = [];

    for (const token of lineTokens) {
      const tokenStart = globalOffset;
      const tokenEnd = globalOffset + token.content.length;

      // Find ranges overlapping this token
      const overlapping = ranges.filter(
        (r) => r.start < tokenEnd && r.end > tokenStart
      );

      const style = token.color ? ` style="color: ${token.color}"` : '';
      const escaped = escapeHtml(token.content);

      if (overlapping.length > 0) {
        // Use the first overlapping range for the link
        const range = overlapping[0];
        spans.push(
          `<a href="${escapeHtml(
            range.path
          )}" class="typedoc-link"><span${style}>${escaped}</span></a>`
        );
      } else {
        spans.push(`<span${style}>${escaped}</span>`);
      }

      globalOffset = tokenEnd;
    }

    lines.push(spans.join(''));
    // Account for newline between lines
    globalOffset += 1;
  }

  return `<pre class="shiki ${theme}"><code>${lines.join('\n')}</code></pre>`;
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Render a TypeDoc `Type` to syntax-highlighted HTML with linked references.
 *
 * Pipeline:
 * 1. Walk the type tree → plain string + range map
 * 2. Optionally format with prettier
 * 3. Tokenize with Shiki
 * 4. Merge tokens with ranges → HTML with `<a>` links
 */
export async function renderTypeToHtml(
  type: Type,
  resolveUrl: ResolveUrl,
  options?: { theme?: BundledTheme; format?: boolean }
): Promise<string> {
  const result = typeToStringWithRanges(type, resolveUrl);
  return renderSignatureToHtml(result.text, result.ranges, options);
}

/**
 * Render a pre-built signature string with ranges to syntax-highlighted HTML.
 *
 * Takes a plain text signature and its ranges (e.g., from `typeToStringWithRanges`),
 * applies optional prettier formatting + Shiki tokenization + range merging,
 * and returns an HTML string.
 */
export async function renderSignatureToHtml(
  signatureText: string,
  ranges: TypeRange[],
  options?: { theme?: BundledTheme; format?: boolean }
): Promise<string> {
  const theme = options?.theme ?? 'github-dark';
  let text = signatureText;
  let activeRanges = ranges;

  if (options?.format !== false) {
    const formatted = await formatWithPrettier(text);
    if (formatted !== null) {
      activeRanges = remapRanges({ text, ranges }, formatted);
      text = formatted;
    }
  }

  return mergeTokensAndRanges(text, activeRanges, theme);
}
