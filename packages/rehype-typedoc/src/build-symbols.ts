import {
  ConsoleLogger,
  Deserializer,
  FileRegistry,
  LogLevel,
  normalizePath,
  ReflectionKind,
  type DeclarationReflection,
  type JSONOutput,
} from 'typedoc';
import type { RehypeTypedocSymbol, SymbolEntry } from './plugin.js';

/** A TypeDoc JSON document with its associated package slug. */
export interface TypeDocDocument {
  packageSlug: string;
  /**
   * Raw TypeDoc JSON output (the top-level project object).
   * Typed as `unknown` because the JSON comes from disk or a serializer;
   * the Deserializer validates the shape at runtime.
   */
  json: JSONOutput.ProjectReflection | unknown;
}

/** Convert camelCase/PascalCase to kebab-case for URL slugs. */
function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

/** Map a TypeDoc ReflectionKind to a human-readable kind string. */
function kindToString(kind: ReflectionKind): string | undefined {
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
      return undefined;
  }
}

/**
 * Check if a reflection is a re-export from another package.
 * TypeDoc inlines re-exported symbols as full declarations, but
 * their source file path points to the original package's dist.
 */
function isReExported(
  reflection: DeclarationReflection,
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

  // Source in another package's dist or node_modules → re-export
  if (source.includes('/dist/') || source.includes('node_modules/')) {
    return true;
  }

  // Source references a different package directory
  const match = source.match(/^(?:packages\/)?([^/]+)\//);
  if (match && match[1] !== packageSlug) {
    return true;
  }

  return false;
}

/**
 * Build a symbols map from TypeDoc JSON documents using the TypeDoc Deserializer.
 *
 * Deserializes each document into a full ProjectReflection, then walks
 * the top-level declarations to extract symbol metadata. This approach
 * is more robust than raw JSON walking because it uses TypeDoc's own
 * model for kind classification and source resolution.
 *
 * When multiple packages export the same symbol name, the map stores an
 * array of entries. The rehype-typedoc plugin filters out re-exports to
 * resolve ambiguity, and throws only if genuinely ambiguous definitions remain.
 */
export function buildSymbolsFromDocuments(
  documents: TypeDocDocument[],
  buildUrl: (packageSlug: string, symbolSlug?: string) => string
): Map<string, SymbolEntry> {
  const map = new Map<string, SymbolEntry>();
  const logger = new ConsoleLogger();
  logger.level = LogLevel.None;
  const deserializer = new Deserializer(logger);

  for (const { packageSlug, json } of documents) {
    const registry = new FileRegistry();
    const project = deserializer.reviveProject(packageSlug, json as JSONOutput.ProjectReflection, {
      projectRoot: normalizePath('/'),
      registry,
    });

    function walkReflections(reflections: DeclarationReflection[]) {
      for (const reflection of reflections) {
        if (reflection.name.startsWith('_')) continue;
        if (reflection.flags.isPrivate || reflection.flags.isProtected) continue;

        // Modules: walk their children recursively
        if (reflection.kind === ReflectionKind.Module && reflection.children) {
          walkReflections(reflection.children as DeclarationReflection[]);
          continue;
        }

        const kind = kindToString(reflection.kind);
        if (!kind) continue;

        const symbolSlug = slugify(reflection.name);
        const path = buildUrl(packageSlug, symbolSlug);
        const reExport = isReExported(reflection, packageSlug);

        const sym: RehypeTypedocSymbol = {
          name: reflection.name,
          package: packageSlug,
          path,
          kind,
          ...(reExport ? { isReExport: true } : {}),
        };

        const existing = map.get(reflection.name);
        if (!existing) {
          map.set(reflection.name, sym);
        } else if (Array.isArray(existing)) {
          existing.push(sym);
        } else {
          // Promote single entry to array
          map.set(reflection.name, [existing, sym]);
        }
      }
    }

    if (project.children) {
      walkReflections(project.children as DeclarationReflection[]);
    }
  }

  return map;
}
