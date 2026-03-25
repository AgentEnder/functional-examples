import {
  ConsoleLogger,
  type DeclarationReflection,
  Deserializer,
  FileRegistry,
  IntersectionType,
  LogLevel,
  normalizePath,
  ReflectionKind,
  type SignatureReflection,
  type Type,
  UnionType,
} from 'typedoc';

import type {
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
} from './types.js';
import { isEmptyReflectionType } from './type-utils.js';
import {
  extractCategory,
  extractCommentText,
  slugify,
  stripCodeFences,
} from './utils.js';

// ---------------------------------------------------------------------------
// Type stringification — filters empty ReflectionType members
// ---------------------------------------------------------------------------

/**
 * Regex to strip empty `{}` intersection/union members from a type string.
 * Handles: `& {}`, `{} &`, `| {}`, `{} |` with surrounding whitespace.
 */
const EMPTY_MEMBER_RE = /\s*[&|]\s*\{\}|\{\}\s*[&|]\s*/g;

/**
 * Convert a TypeDoc `Type` to string, filtering out empty `{}` members
 * from union and intersection types.
 *
 * For direct IntersectionType/UnionType, filters members before stringifying.
 * For other types (e.g. ReferenceType with type arguments containing
 * intersections), falls back to toString() with post-processing to strip
 * `& {}` / `| {}` artifacts from nested types.
 */
function typeToString(type: Type): string {
  if (type instanceof IntersectionType) {
    const parts = type.types.filter((t) => !isEmptyReflectionType(t));
    if (parts.length === 0) return '{}';
    if (parts.length === 1) return typeToString(parts[0]);
    return parts.map((t) => typeToString(t)).join(' & ');
  }
  if (type instanceof UnionType) {
    const parts = type.types.filter((t) => !isEmptyReflectionType(t));
    if (parts.length === 0) return '{}';
    if (parts.length === 1) return typeToString(parts[0]);
    return parts.map((t) => typeToString(t)).join(' | ');
  }
  // For container types (ReferenceType with type args, ArrayType, etc.),
  // TypeDoc's toString() may include nested empty reflections. Clean them.
  const str = type.toString();
  if (!str.includes('{}')) return str;
  return str.replace(EMPTY_MEMBER_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extended ApiExport that carries the raw TypeDoc `Type` reference
 * for downstream type renderers.
 */
export interface ApiExportWithTypeRef extends ApiExport {
  /** Raw TypeDoc Type object for linked HTML rendering. */
  _typeRef?: Type;
}

// ---------------------------------------------------------------------------
// Kind mapping
// ---------------------------------------------------------------------------

function reflectionKindToApiKind(kind: ReflectionKind): ApiExportKind {
  switch (kind) {
    case ReflectionKind.Function:
      return 'function';
    case ReflectionKind.Class:
      return 'class';
    case ReflectionKind.Interface:
      return 'interface';
    case ReflectionKind.TypeAlias:
      return 'type';
    case ReflectionKind.Enum:
      return 'enum';
    case ReflectionKind.Variable:
      return 'variable';
    default:
      return 'variable';
  }
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

function parseCommentFromReflection(
  comment: DeclarationReflection['comment'] | SignatureReflection['comment']
): ApiComment | undefined {
  if (!comment) return undefined;

  const result: ApiComment = {};

  if (comment.summary) {
    const parts = comment.summary.map((p) => p.text);
    const text = parts.join('').trim();
    if (text) result.summary = text;
  }

  const remarksTag = comment.getTag('@remarks');
  if (remarksTag) {
    result.remarks = extractCommentText(
      remarksTag.content as Array<{ kind: string; text: string }>
    );
  }

  const exampleTags = comment.getTags('@example');
  if (exampleTags.length > 0) {
    result.examples = [];
    for (const tag of exampleTags) {
      const text = extractCommentText(
        tag.content as Array<{ kind: string; text: string }>
      );
      if (text) result.examples.push(stripCodeFences(text));
    }
  }

  const seeTags = comment.getTags('@see');
  if (seeTags.length > 0) {
    result.see = [];
    for (const tag of seeTags) {
      const text = extractCommentText(
        tag.content as Array<{ kind: string; text: string }>
      );
      if (text) result.see.push(text);
    }
  }

  const deprecatedTag = comment.getTag('@deprecated');
  if (deprecatedTag) {
    result.deprecated =
      extractCommentText(
        deprecatedTag.content as Array<{ kind: string; text: string }>
      ) || 'Deprecated';
  } else if (comment.hasModifier('@deprecated')) {
    result.deprecated = 'Deprecated';
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function getCategoryFromComment(
  comment: DeclarationReflection['comment'] | SignatureReflection['comment']
): string | undefined {
  if (!comment) return undefined;
  const tag = comment.getTag('@category');
  if (!tag) return undefined;
  return extractCommentText(
    tag.content as Array<{ kind: string; text: string }>
  );
}

// ---------------------------------------------------------------------------
// Re-export detection
// ---------------------------------------------------------------------------

function isReExportedSymbol(
  reflection: DeclarationReflection,
  packageSlug: string
): boolean {
  const source = reflection.sources?.[0]?.fileName;
  if (!source) return false;

  if (
    source.startsWith(`packages/${packageSlug}/`) ||
    source.startsWith(`${packageSlug}/src/`)
  ) {
    return false;
  }

  if (source.includes('/dist/') || source.includes('node_modules/')) {
    return true;
  }

  const packageDirMatch = source.match(/^(?:packages\/)?([^/]+)\//);
  if (packageDirMatch && packageDirMatch[1] !== packageSlug) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Module detection from source path
// ---------------------------------------------------------------------------

function getModuleFromSource(
  reflection: DeclarationReflection
): string {
  const source = reflection.sources?.[0]?.fileName;
  if (!source) return 'core';
  const match = source.match(/src\/([^/]+)\//);
  if (match) return match[1];
  return 'core';
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

function buildTypeParameters(
  typeParams:
    | DeclarationReflection['typeParameters']
    | SignatureReflection['typeParameters']
): ApiTypeParameter[] | undefined {
  if (!typeParams || typeParams.length === 0) return undefined;
  return typeParams.map((tp) => ({
    name: tp.name,
    constraint: tp.type ? typeToString(tp.type) : undefined,
    default: tp.default ? typeToString(tp.default) : undefined,
  }));
}

function buildParameters(
  sig: SignatureReflection
): ApiParameter[] | undefined {
  if (!sig.parameters || sig.parameters.length === 0) return undefined;
  return sig.parameters.map((p) => ({
    name: p.name,
    type: p.type ? typeToString(p.type) : 'unknown',
    description: p.comment?.summary
      ? extractCommentText(
          p.comment.summary as Array<{ kind: string; text: string }>
        )
      : undefined,
    optional: p.flags.isOptional || undefined,
    defaultValue: p.defaultValue,
  }));
}

function buildProperties(
  children: DeclarationReflection[]
): ApiProperty[] | undefined {
  const props: ApiProperty[] = [];
  for (const child of children) {
    if (child.kind !== ReflectionKind.Property) continue;
    if (child.inheritedFrom) continue;
    props.push({
      name: child.name,
      type: child.type ? typeToString(child.type) : 'unknown',
      description: child.comment?.summary
        ? extractCommentText(
            child.comment.summary as Array<{ kind: string; text: string }>
          )
        : undefined,
      optional: child.flags.isOptional || undefined,
      readonly: child.flags.isReadonly || undefined,
    });
  }
  return props.length > 0 ? props : undefined;
}

function buildMethods(
  children: DeclarationReflection[]
): ApiMethod[] | undefined {
  const methods: ApiMethod[] = [];
  for (const child of children) {
    if (child.kind === ReflectionKind.Constructor) continue;
    if (child.inheritedFrom) continue;
    if (child.kind !== ReflectionKind.Method && !child.signatures) continue;

    const sig = child.signatures?.[0];
    if (!sig) continue;

    const params = buildParameters(sig);
    const paramStr =
      params
        ?.map(
          (p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`
        )
        .join(', ') || '';
    const returnType = sig.type ? typeToString(sig.type) : 'void';

    methods.push({
      name: child.name,
      signature: `${child.name}(${paramStr}): ${returnType}`,
      description: sig.comment?.summary
        ? extractCommentText(
            sig.comment.summary as Array<{ kind: string; text: string }>
          )
        : undefined,
      parameters: params,
      returnType,
    });
  }
  return methods.length > 0 ? methods : undefined;
}

// ---------------------------------------------------------------------------
// Build a single ApiExport from a DeclarationReflection
// ---------------------------------------------------------------------------

function buildExport(
  reflection: DeclarationReflection,
  packageSlug: string
): ApiExportWithTypeRef | null {
  const kind = reflectionKindToApiKind(reflection.kind);
  const exportSlug = slugify(reflection.name);
  const reExport = isReExportedSymbol(reflection, packageSlug);

  const exp: ApiExportWithTypeRef = {
    name: reflection.name,
    slug: exportSlug,
    path: '',
    package: packageSlug,
    kind,
    ...(reExport ? { isReExport: true } : {}),
  };

  // Functions — extract from signature
  if (reflection.signatures && reflection.signatures.length > 0) {
    const sig = reflection.signatures[0];
    exp.comment = parseCommentFromReflection(sig.comment);
    exp.description = exp.comment?.summary;
    exp.category = getCategoryFromComment(sig.comment) ??
      extractCategory(
        reflection.comment as Parameters<typeof extractCategory>[0]
      );

    exp.parameters = buildParameters(sig);
    exp.typeParameters = buildTypeParameters(sig.typeParameters);

    if (sig.type) {
      exp.returnType = typeToString(sig.type);
      exp._typeRef = sig.type;
    }

    const typeParamStr = exp.typeParameters
      ? `<${exp.typeParameters.map((tp) => tp.name).join(', ')}>`
      : '';
    const paramStr = exp.parameters
      ? exp.parameters
          .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
          .join(', ')
      : '';
    exp.signature = `function ${reflection.name}${typeParamStr}(${paramStr}): ${
      exp.returnType || 'void'
    }`;
  } else {
    // Non-function: type alias, interface, class, enum, variable
    exp.comment = parseCommentFromReflection(reflection.comment);
    exp.description = exp.comment?.summary;
    exp.category = getCategoryFromComment(reflection.comment) ??
      extractCategory(
        reflection.comment as Parameters<typeof extractCategory>[0]
      );

    // Type alias — store type reference and string
    if (reflection.type) {
      exp.signature = `type ${reflection.name} = ${typeToString(reflection.type)}`;
      exp._typeRef = reflection.type;
    }

    // Interface / class children
    if (reflection.children && reflection.children.length > 0) {
      const declChildren = reflection.children as DeclarationReflection[];
      exp.properties = buildProperties(declChildren);
      exp.methods = buildMethods(declChildren);
    }

    // Interface / class signature
    if (
      reflection.kind === ReflectionKind.Interface ||
      reflection.kind === ReflectionKind.Class
    ) {
      const keyword =
        reflection.kind === ReflectionKind.Interface ? 'interface' : 'class';
      let typeParamStr = '';
      if (
        reflection.typeParameters &&
        reflection.typeParameters.length > 0
      ) {
        typeParamStr = `<${reflection.typeParameters
          .map((tp) => tp.name)
          .join(', ')}>`;
      }
      exp.signature = `${keyword} ${reflection.name}${typeParamStr}`;

      if (
        reflection.extendedTypes &&
        reflection.extendedTypes.length > 0
      ) {
        exp.signature += ` extends ${reflection.extendedTypes
          .map((t) => typeToString(t))
          .join(', ')}`;
      }
    }
  }

  return exp;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deserialize TypeDoc JSON using TypeDoc's native `Deserializer.reviveProject()`
 * and walk the resulting `ProjectReflection` to produce an `ApiPackage`.
 */
export function deserializeTypedocJson(
  json: unknown,
  packageSlug: string,
  packageName: string
): ApiPackage {
  const logger = new ConsoleLogger();
  logger.level = LogLevel.None;
  const deserializer = new Deserializer(logger);
  const registry = new FileRegistry();

  const project = deserializer.reviveProject(
    packageSlug,
    json as Parameters<Deserializer['reviveProject']>[1],
    { projectRoot: normalizePath('/'), registry }
  );

  const moduleMap = new Map<string, DeclarationReflection[]>();

  function categorize(reflection: DeclarationReflection): void {
    if (reflection.name.startsWith('_')) return;
    if (reflection.flags.isPrivate || reflection.flags.isProtected) return;

    // Module containers — recurse into their children
    if (
      reflection.kind === ReflectionKind.Module &&
      reflection.children
    ) {
      for (const child of reflection.children as DeclarationReflection[]) {
        categorize(child);
      }
      return;
    }

    const moduleName = getModuleFromSource(reflection);
    const existing = moduleMap.get(moduleName);
    if (existing) {
      existing.push(reflection);
    } else {
      moduleMap.set(moduleName, [reflection]);
    }
  }

  if (project.children) {
    for (const child of project.children as DeclarationReflection[]) {
      categorize(child);
    }
  }

  const modules: ApiModule[] = [];
  const allExports: ApiExport[] = [];

  for (const [moduleName, reflections] of moduleMap) {
    const moduleExports: ApiExport[] = [];

    for (const reflection of reflections) {
      const exp = buildExport(reflection, packageSlug);
      if (exp) {
        moduleExports.push(exp);
        allExports.push(exp);
      }
    }

    moduleExports.sort((a, b) => a.name.localeCompare(b.name));
    modules.push({ name: moduleName, exports: moduleExports });
  }

  modules.sort((a, b) => a.name.localeCompare(b.name));
  allExports.sort((a, b) => a.name.localeCompare(b.name));

  // Disambiguate colliding slugs
  const slugCounts = new Map<string, ApiExport[]>();
  for (const exp of allExports) {
    const group = slugCounts.get(exp.slug);
    if (group) {
      group.push(exp);
    } else {
      slugCounts.set(exp.slug, [exp]);
    }
  }
  for (const [, group] of slugCounts) {
    if (group.length < 2) continue;
    for (const exp of group) {
      exp.slug = `${exp.slug}-${exp.kind}`;
    }
  }

  return {
    name: packageName,
    slug: packageSlug,
    modules,
    exports: allExports,
  };
}

/**
 * Combine multiple package API docs into a unified `ApiDocs` structure.
 */
export function combineApiDocs(packages: ApiPackage[]): ApiDocs {
  const packagesMap: Record<string, ApiPackage> = {};
  const allExports: ApiExport[] = [];

  for (const pkg of packages) {
    packagesMap[pkg.slug] = pkg;
    allExports.push(...pkg.exports);
  }

  allExports.sort((a, b) => a.name.localeCompare(b.name));

  return { packages: packagesMap, allExports };
}
