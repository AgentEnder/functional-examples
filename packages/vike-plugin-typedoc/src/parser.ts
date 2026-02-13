import type {
  ApiDocs,
  ApiExport,
  ApiModule,
  ApiPackage,
  TypeDocJson,
  TypeDocReflection,
} from './types.js';
import { KIND } from './types.js';
import {
  extractCategory,
  extractCommentText,
  kindToApiKind,
  parseComment,
  slugify,
  typeToString,
} from './utils.js';

/**
 * Check if a reflection is a re-export from another package.
 * TypeDoc inlines re-exported symbols as full declarations, but
 * their source file path points to the original package's dist.
 */
function isReExportedSymbol(
  reflection: TypeDocReflection,
  packageSlug: string
): boolean {
  const source = reflection.sources?.[0]?.fileName;
  if (!source) return false;

  // Own source: matches `packages/<slug>/src/...` or `<slug>/src/...`
  if (
    source.startsWith(`packages/${packageSlug}/`) ||
    source.startsWith(`${packageSlug}/src/`)
  ) {
    return false;
  }

  // Source is in another package's dist (e.g. `devkit/dist/types/index.d.ts`)
  // or another package's src — this is a re-export
  if (source.includes('/dist/') || source.includes('node_modules/')) {
    return true;
  }

  // Source references a different package directory
  const packageDirMatch = source.match(/^(?:packages\/)?([^/]+)\//);
  if (packageDirMatch && packageDirMatch[1] !== packageSlug) {
    return true;
  }

  return false;
}

/**
 * Parse a single export reflection into an ApiExport.
 */
function parseExport(
  reflection: TypeDocReflection,
  packageSlug: string,
  _moduleName: string
): ApiExport | null {
  const kind = kindToApiKind(reflection.kind);
  const slug = slugify(reflection.name);
  const reExport = isReExportedSymbol(reflection, packageSlug);

  const exp: ApiExport = {
    name: reflection.name,
    slug,
    path: '',
    package: packageSlug,
    kind,
    ...(reExport ? { isReExport: true } : {}),
  };

  // Parse function signatures
  if (reflection.signatures && reflection.signatures.length > 0) {
    const sig = reflection.signatures[0];
    exp.comment = parseComment(sig.comment);
    exp.description = exp.comment?.summary;
    exp.category = extractCategory(sig.comment);

    if (sig.parameters) {
      exp.parameters = sig.parameters.map((p) => ({
        name: p.name,
        type: typeToString(p.type),
        description: extractCommentText(p.comment?.summary),
        optional: p.flags?.isOptional,
        defaultValue: p.defaultValue,
      }));
    }

    if (sig.type) {
      exp.returnType = typeToString(sig.type);
    }

    if (sig.typeParameter) {
      exp.typeParameters = sig.typeParameter.map((tp) => ({
        name: tp.name,
        constraint: tp.type ? typeToString(tp.type) : undefined,
        default: tp.default ? typeToString(tp.default) : undefined,
      }));
    }

    // Build signature string
    const typeParams = exp.typeParameters
      ? `<${exp.typeParameters.map((tp) => tp.name).join(', ')}>`
      : '';
    const params = exp.parameters
      ? exp.parameters
          .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
          .join(', ')
      : '';
    exp.signature = `function ${reflection.name}${typeParams}(${params}): ${
      exp.returnType || 'void'
    }`;
  } else {
    // Non-function: type alias, interface, class, etc.
    exp.comment = parseComment(reflection.comment);
    exp.description = exp.comment?.summary;
    exp.category = extractCategory(reflection.comment);

    if (reflection.type) {
      exp.signature = `type ${reflection.name} = ${typeToString(
        reflection.type
      )}`;
    }

    // Parse interface/class children (properties, methods)
    if (reflection.children) {
      exp.properties = [];
      exp.methods = [];

      for (const child of reflection.children) {
        if (child.kind === KIND.Constructor) continue;
        if (child.inheritedFrom) continue;

        if (child.kind === KIND.Method || child.signatures) {
          const methodSig = child.signatures?.[0];
          if (methodSig) {
            const methodParams =
              methodSig.parameters
                ?.map(
                  (p) =>
                    `${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeToString(
                      p.type
                    )}`
                )
                .join(', ') || '';
            exp.methods.push({
              name: child.name,
              signature: `${child.name}(${methodParams}): ${typeToString(
                methodSig.type
              )}`,
              description: extractCommentText(methodSig.comment?.summary),
              parameters: methodSig.parameters?.map((p) => ({
                name: p.name,
                type: typeToString(p.type),
                description: extractCommentText(p.comment?.summary),
                optional: p.flags?.isOptional,
              })),
              returnType: typeToString(methodSig.type),
            });
          }
        } else if (child.kind === KIND.Property) {
          exp.properties.push({
            name: child.name,
            type: typeToString(child.type),
            description: extractCommentText(child.comment?.summary),
            optional: child.flags?.isOptional,
            readonly: child.flags?.isReadonly,
          });
        }
      }

      if (exp.properties.length === 0) delete exp.properties;
      if (exp.methods.length === 0) delete exp.methods;
    }

    // Build signature for interfaces and classes
    if (reflection.kind === KIND.Interface || reflection.kind === KIND.Class) {
      const keyword =
        reflection.kind === KIND.Interface ? 'interface' : 'class';
      let typeParams = '';
      if (reflection.typeParameters && reflection.typeParameters.length > 0) {
        typeParams = `<${reflection.typeParameters
          .map((tp) => tp.name)
          .join(', ')}>`;
      }
      exp.signature = `${keyword} ${reflection.name}${typeParams}`;

      if (reflection.extendedTypes && reflection.extendedTypes.length > 0) {
        exp.signature += ` extends ${reflection.extendedTypes
          .map(typeToString)
          .join(', ')}`;
      }
    }
  }

  return exp;
}

/**
 * Determine module name from source file path.
 */
function getModuleFromSource(source?: string): string {
  if (!source) return 'core';
  // Match patterns like src/glob/, src/yaml/, src/json/
  const match = source.match(/src\/([^/]+)\//);
  if (match) return match[1];
  return 'core';
}

/**
 * Parse TypeDoc JSON output for a single package into an ApiPackage.
 */
export function parseTypedocJson(
  json: unknown,
  packageSlug: string,
  packageName: string
): ApiPackage {
  const doc = json as TypeDocJson;
  const moduleMap = new Map<string, TypeDocReflection[]>();

  function categorizeReflection(reflection: TypeDocReflection) {
    if (reflection.name.startsWith('_')) return;
    if (reflection.flags.isPrivate || reflection.flags.isProtected) return;

    // If this is a module, recursively process its children
    if (reflection.kind === KIND.Module && reflection.children) {
      for (const child of reflection.children) {
        categorizeReflection(child);
      }
      return;
    }

    const source = reflection.sources?.[0]?.fileName;
    const moduleName = getModuleFromSource(source);

    const existing = moduleMap.get(moduleName);
    if (existing) {
      existing.push(reflection);
    } else {
      moduleMap.set(moduleName, [reflection]);
    }
  }

  if (doc.children) {
    for (const child of doc.children) {
      categorizeReflection(child);
    }
  }

  const modules: ApiModule[] = [];
  const allExports: ApiExport[] = [];

  for (const [moduleName, reflections] of moduleMap) {
    const moduleExports: ApiExport[] = [];

    for (const reflection of reflections) {
      const exp = parseExport(reflection, packageSlug, moduleName);
      if (exp) {
        moduleExports.push(exp);
        allExports.push(exp);
      }
    }

    moduleExports.sort((a, b) => a.name.localeCompare(b.name));

    modules.push({
      name: moduleName,
      exports: moduleExports,
    });
  }

  modules.sort((a, b) => a.name.localeCompare(b.name));
  allExports.sort((a, b) => a.name.localeCompare(b.name));

  // Disambiguate exports with colliding slugs (e.g. templateHelpers vs TemplateHelpers)
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
 * Combine multiple package API docs into a unified ApiDocs structure.
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
