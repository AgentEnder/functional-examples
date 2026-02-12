import type {
  ApiComment,
  ApiExportKind,
  TypeDocComment,
  TypeDocType,
} from './types.js';
import { KIND } from './types.js';

/** Convert camelCase/PascalCase to kebab-case for URL slugs. */
export function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

/** Extract plain text from TypeDoc comment parts. */
export function extractCommentText(
  parts?: Array<{ kind: string; text: string }>
): string | undefined {
  if (!parts || parts.length === 0) return undefined;
  return (
    parts
      .map((p) => {
        // TypeDoc's TSDoc parser mangles `*\/` (the JSDoc workaround for
        // literal `*/` inside block comments) into `*\` — it drops the `/`.
        // Within code blocks, restore `*\` at end-of-line to `*/`.
        if (p.kind === 'code') {
          return p.text.replace(/\*\\$/gm, '*/');
        }
        return p.text;
      })
      .join('')
      .trim() || undefined
  );
}

/**
 * Strip markdown code fences from example blocks.
 * TypeDoc includes ```language ... ``` markers in examples.
 */
export function stripCodeFences(text: string): string {
  const match = text.match(/^```\w*\n?([\s\S]*?)\n?```$/);
  if (match) {
    return match[1].trim();
  }
  return text;
}

/** Parse a TypeDoc comment into our ApiComment structure. */
export function parseComment(
  comment?: TypeDocComment
): ApiComment | undefined {
  if (!comment) return undefined;

  const result: ApiComment = {};

  if (comment.summary) {
    result.summary = extractCommentText(comment.summary);
  }

  if (comment.blockTags) {
    for (const tag of comment.blockTags) {
      const text = extractCommentText(tag.content);
      switch (tag.tag) {
        case '@remarks':
          result.remarks = text;
          break;
        case '@example':
          result.examples = result.examples || [];
          if (text) result.examples.push(stripCodeFences(text));
          break;
        case '@see':
          result.see = result.see || [];
          if (text) result.see.push(text);
          break;
        case '@deprecated':
          result.deprecated = text || 'Deprecated';
          break;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Extract @category tag from a TypeDoc comment. */
export function extractCategory(
  comment?: TypeDocComment
): string | undefined {
  if (!comment?.blockTags) return undefined;

  for (const tag of comment.blockTags) {
    if (tag.tag === '@category') {
      return extractCommentText(tag.content);
    }
  }

  return undefined;
}

/** Convert a TypeDoc type to a human-readable string. */
export function typeToString(type?: TypeDocType): string {
  if (!type) return 'unknown';

  switch (type.type) {
    case 'intrinsic':
      return type.name || 'unknown';
    case 'reference': {
      let result = type.name || 'unknown';
      if (type.typeArguments && type.typeArguments.length > 0) {
        result += `<${type.typeArguments.map(typeToString).join(', ')}>`;
      }
      return result;
    }
    case 'literal':
      return JSON.stringify(type.value);
    case 'union':
      return type.types?.map(typeToString).join(' | ') || 'unknown';
    case 'intersection':
      return type.types?.map(typeToString).join(' & ') || 'unknown';
    case 'array':
      return `${typeToString(type.elementType)}[]`;
    case 'tuple':
      return `[${type.types?.map(typeToString).join(', ') || ''}]`;
    case 'reflection':
      if (type.declaration?.signatures) {
        const sig = type.declaration.signatures[0];
        const params =
          sig.parameters
            ?.map((p) => `${p.name}: ${typeToString(p.type)}`)
            .join(', ') || '';
        return `(${params}) => ${typeToString(sig.type)}`;
      }
      if (type.declaration?.children) {
        const props = type.declaration.children
          .map((c) => `${c.name}: ${typeToString(c.type)}`)
          .join('; ');
        return `{ ${props} }`;
      }
      return '{ ... }';
    case 'indexedAccess':
      return `${typeToString(type.objectType)}[${typeToString(type.indexType)}]`;
    case 'conditional':
      return `${typeToString(type.checkType)} extends ${typeToString(type.extendsType)} ? ${typeToString(type.trueType)} : ${typeToString(type.falseType)}`;
    case 'mapped':
      return '{ [key: string]: ... }';
    case 'typeOperator':
      return `${type.operator || ''} ${typeToString(type.target as TypeDocType)}`;
    case 'query':
      return `typeof ${typeToString(type.target as TypeDocType)}`;
    case 'predicate':
      return 'boolean';
    case 'rest':
      return `...${typeToString(type.elementType)}`;
    case 'optional':
      return `${typeToString(type.elementType)}?`;
    case 'templateLiteral':
      return 'string';
    case 'namedTupleMember':
      return type.name || 'unknown';
    default:
      return type.name || 'unknown';
  }
}

/** Map a TypeDoc kind number to our ApiExportKind. */
export function kindToApiKind(kind: number): ApiExportKind {
  switch (kind) {
    case KIND.Function:
      return 'function';
    case KIND.Class:
      return 'class';
    case KIND.Interface:
      return 'interface';
    case KIND.TypeAlias:
      return 'type';
    case KIND.Enum:
      return 'enum';
    case KIND.Variable:
      return 'variable';
    default:
      return 'variable';
  }
}
