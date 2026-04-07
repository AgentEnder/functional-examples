import rehypeTypedoc, { rehypeTypedocCodeBlocks } from 'rehype-typedoc';
import type { RehypeTypedocOptions, TypeDocDocument } from 'rehype-typedoc';
import type { BundledTheme } from 'shiki';
import type { Type } from 'typedoc';
import type { Plugin, PluggableList } from 'unified';
import { combineApiDocs } from './deserialize.js';
import {
  buildMarkdownProcessor,
  renderExportMarkdown,
  type RenderedExportMarkdown,
} from './markdown.js';
import { buildApiNavigation } from './navigation.js';
import { renderSignatureToHtml, type TypeRange } from './type-renderer.js';
import type {
  ApiDocs,
  ApiExport,
  ApiPackage,
  LinkedApiExport,
  NavigationItem,
} from './types.js';

// ---------------------------------------------------------------------------
// Inline symbol linking (replaces linkify.ts)
// ---------------------------------------------------------------------------

const IDENTIFIER_RE = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
const TOKEN_RE = /([a-zA-Z_$][a-zA-Z0-9_$]*)|([^a-zA-Z_$]+)/g;

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
 * Convert a type string to HTML with known symbols wrapped in `<a>` tags.
 */
function linkifyType(
  typeStr: string,
  resolveUrl: (name: string) => string | undefined
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
    const href = resolveUrl(identifier);
    if (!href) {
      result += escapeHtml(identifier);
      continue;
    }
    result += `<a href="${escapeHtml(href)}" class="typedoc-link">${escapeHtml(identifier)}</a>`;
  }
  return result;
}

/**
 * Find symbol ranges in a text string for use with the type renderer.
 */
function findSymbolRanges(
  text: string,
  resolveUrl: (name: string) => string | undefined
): TypeRange[] {
  const ranges: TypeRange[] = [];
  IDENTIFIER_RE.lastIndex = 0;
  let m;
  while ((m = IDENTIFIER_RE.exec(text)) !== null) {
    const name = m[0];
    if (SKIP_TOKENS.has(name)) continue;
    const url = resolveUrl(name);
    if (url) {
      ranges.push({ start: m.index, end: m.index + name.length, path: url });
    }
  }
  return ranges;
}

type LinkifyFn = (typeStr: string) => string;

function linkifyApiExport(exp: ApiExport, linkify: LinkifyFn): LinkedApiExport {
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

// ---------------------------------------------------------------------------
// Context options and interface
// ---------------------------------------------------------------------------

export interface TypedocContextOptions {
  /**
   * Build a URL for a package or symbol page.
   * Called for every link the plugin generates.
   *
   * @default (pkg, sym) => sym ? `/api/${pkg}/${sym}` : `/api/${pkg}`
   */
  buildUrl?: (packageSlug: string, symbolSlug?: string) => string;

  /**
   * Base path prefix for generated URLs.
   * Used to build the default `buildUrl` when no custom function is provided.
   *
   * @default '/api'
   * @example '/docs/api' -> URLs like `/docs/api/devkit/parse-json`
   */
  basePath?: string;

  /**
   * Deployment base URL to prepend to rendered HTML links.
   *
   * When set, `applyBaseUrl` prepends this base to every route-relative path.
   * Stored paths (`exp.path`, `navItem.path`) and prerender URLs are
   * **not** affected -- they remain route-relative.
   *
   * Typically read from `globalContext.baseServer` in the Vike hook.
   *
   * @default '/'
   */
  baseUrl?: string;

  /**
   * Additional remark plugins to include in the markdown pipeline.
   * These run after the baked-in plugins (remark-gfm, remark-code-props)
   * and before remark-rehype.
   */
  remarkPlugins?: PluggableList;

  /**
   * Additional rehype plugins to include in the markdown pipeline.
   * These run after the baked-in rehype-typedoc plugin and before
   * rehype-stringify. Use this to add syntax highlighting
   * (e.g., `@shikijs/rehype`).
   */
  rehypePlugins?: PluggableList;

  /** Shiki theme for signature syntax highlighting */
  theme?: BundledTheme;

  /** Raw TypeDoc JSON documents for rehype-typedoc auto-linking */
  documents?: TypeDocDocument[];
}

export interface TypedocContext {
  /** All parsed API documentation */
  apiDocs: ApiDocs;
  /** Navigation items for sidebar */
  navigation: NavigationItem[];
  /** The resolved base URL (from options.baseUrl, normalized) */
  baseUrl: string;
  /** Prepend the deployment base URL to a route-relative path */
  applyBaseUrl(path: string): string;
  /** Get a linked export by package + symbol slug */
  getLinkedExport(packageSlug: string, symbolSlug: string): LinkedApiExport | null;
  /** Get package info */
  getPackage(packageSlug: string): ApiPackage | null;
  /** Get all export URLs (for pre-rendering) */
  getExportUrls(): string[];
  /** Get all package-level URLs (for pre-rendering) */
  getPackageUrls(): string[];
  /** Get all prerender URLs (packages + exports) */
  getAllPrerenderUrls(): string[];
  /** Get pre-configured rehype-typedoc plugins for use in custom unified pipelines */
  getRehypePlugins(): Plugin[];
  /** Get the raw TypeDoc Type object for a server-side export (server use only, not serialized) */
  getTypeRef(exp: ApiExport): Type | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createDefaultBuildUrl(basePath: string) {
  return (packageSlug: string, symbolSlug?: string): string =>
    symbolSlug ? `${basePath}/${packageSlug}/${symbolSlug}` : `${basePath}/${packageSlug}`;
}

function createSinglePackageBuildUrl(basePath: string) {
  return (_packageSlug: string, symbolSlug?: string): string =>
    symbolSlug ? `${basePath}/${symbolSlug}` : basePath;
}

/**
 * Build an `applyBaseUrl` function from a raw base URL string.
 *
 * Returns the identity function when the base is falsy, `/`, `./`, or `.`
 * (i.e., no deployment prefix). Otherwise normalizes and prepends the base.
 */
function createApplyBaseUrl(raw: string | undefined): (path: string) => string {
  if (!raw || raw === '/' || raw === './' || raw === '.') {
    return (path) => path;
  }
  const normalizedBase = raw.endsWith('/') ? raw : raw + '/';
  return (path) => {
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    return normalizedBase + normalizedPath;
  };
}

/**
 * Build a cache key for a rendered export: `packageSlug::symbolSlug`
 */
function markdownCacheKey(packageSlug: string, symbolSlug: string): string {
  return `${packageSlug}::${symbolSlug}`;
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

/**
 * Create a TypedocContext from pre-parsed packages.
 *
 * This is the low-level API -- use `loadTypedocContext` for the common case
 * of loading TypeDoc JSON files from disk.
 *
 * The function is async because it eagerly pre-renders all markdown fields
 * (descriptions, remarks, examples) through a unified pipeline so that
 * `getLinkedExport()` can return fully-rendered HTML synchronously.
 */
export async function createTypedocContext(
  packages: ApiPackage[],
  options: TypedocContextOptions = {},
  typeRefs?: Map<ApiExport, Type>
): Promise<TypedocContext> {
  const basePath = options.basePath ?? '/api';
  const isSinglePackage = packages.length === 1;
  const theme = options.theme ?? 'github-dark';

  const typeRefMap = new WeakMap<ApiExport, Type>();
  if (typeRefs) {
    for (const [exp, type] of typeRefs) {
      typeRefMap.set(exp, type);
    }
  }

  // When single-package and no custom buildUrl, skip the package slug
  const buildUrl = options.buildUrl
    ?? (isSinglePackage
      ? createSinglePackageBuildUrl(basePath)
      : createDefaultBuildUrl(basePath));

  const applyBaseUrl = createApplyBaseUrl(options.baseUrl);
  const baseUrl = options.baseUrl ?? '/';

  // Apply buildUrl to every export path
  for (const pkg of packages) {
    for (const exp of pkg.exports) {
      exp.path = buildUrl(pkg.slug, exp.slug);
    }
    for (const mod of pkg.modules) {
      for (const exp of mod.exports) {
        exp.path = buildUrl(pkg.slug, exp.slug);
      }
    }
  }

  const apiDocs = combineApiDocs(packages);
  const navigation = buildApiNavigation(apiDocs, { singlePackage: isSinglePackage });

  // Update navigation paths using buildUrl (only for multi-package)
  if (!isSinglePackage) {
    for (const navItem of navigation) {
      const pkg = Object.values(apiDocs.packages).find(
        (p) => p.name === navItem.title
      );
      if (pkg) {
        navItem.path = buildUrl(pkg.slug);
      }
    }
  }

  // Build resolveUrl: maps symbol name -> base-prefixed URL
  const resolveUrl = (name: string): string | undefined => {
    // Find the first non-re-export with this name
    const exp = apiDocs.allExports.find((e) => e.name === name && !e.isReExport);
    if (exp) return applyBaseUrl(exp.path);
    // Fallback: any export with this name
    const any = apiDocs.allExports.find((e) => e.name === name);
    return any ? applyBaseUrl(any.path) : undefined;
  };

  // Pre-render signatures with Shiki + links
  const signatureCache = new Map<string, string>();
  await Promise.all(
    apiDocs.allExports.map(async (exp) => {
      if (!exp.signature) return;
      const ranges = findSymbolRanges(exp.signature, resolveUrl);
      try {
        const html = await renderSignatureToHtml(exp.signature, ranges, {
          theme,
        });
        signatureCache.set(markdownCacheKey(exp.package, exp.slug), html);
      } catch {
        // Shiki failure -- fall back to no highlighting
      }
    })
  );

  // Build rehype-typedoc options (new API: documents + buildUrl)
  const documents = options.documents;

  const rehypeTypedocOptions: RehypeTypedocOptions | undefined = documents
    ? { documents, buildUrl: (pkg: string, sym?: string) => applyBaseUrl(buildUrl(pkg, sym)) }
    : undefined;

  // Pre-build rehype plugins if documents are available
  let rehypePlugins: Plugin[] | undefined;
  if (rehypeTypedocOptions) {
    rehypePlugins = [
      [rehypeTypedoc, rehypeTypedocOptions] as unknown as Plugin,
      [rehypeTypedocCodeBlocks, rehypeTypedocOptions] as unknown as Plugin,
    ];
  }

  // Build the markdown processor and pre-render all exports
  const processor = buildMarkdownProcessor(
    rehypeTypedocOptions,
    options.remarkPlugins,
    options.rehypePlugins
  );

  const renderedMarkdown = new Map<string, RenderedExportMarkdown>();
  await Promise.all(
    apiDocs.allExports.map(async (exp) => {
      const rendered = await renderExportMarkdown(
        processor,
        exp.comment,
        exp.description,
        exp.returnType
      );
      renderedMarkdown.set(
        markdownCacheKey(exp.package, exp.slug),
        rendered
      );
    })
  );

  return {
    apiDocs,
    navigation,
    baseUrl,
    applyBaseUrl,

    getLinkedExport(packageSlug: string, symbolSlug: string): LinkedApiExport | null {
      const apiPackage = apiDocs.packages[packageSlug];
      if (!apiPackage) return null;

      const rawExport = apiPackage.exports.find((e) => e.slug === symbolSlug);
      if (!rawExport) return null;

      const linked = linkifyApiExport(rawExport, (typeStr) =>
        linkifyType(typeStr, resolveUrl)
      );

      // Merge pre-rendered signature HTML
      const sigHtml = signatureCache.get(markdownCacheKey(packageSlug, symbolSlug));
      if (sigHtml) {
        linked.signatureCodeHtml = sigHtml;
      }

      // Merge pre-rendered markdown HTML (code block linkification is now
      // handled by rehypeTypedocCodeBlocks in the unified pipeline)
      const md = renderedMarkdown.get(markdownCacheKey(packageSlug, symbolSlug));
      if (md) {
        if (md.returnTypeCodeHtml) linked.returnTypeCodeHtml = md.returnTypeCodeHtml;
        if (md.descriptionHtml) linked.descriptionHtml = md.descriptionHtml;
        if (md.remarksHtml) linked.remarksHtml = md.remarksHtml;
        if (md.examplesHtml) linked.examplesHtml = md.examplesHtml;
      }

      return linked;
    },

    getPackage(packageSlug: string): ApiPackage | null {
      const pkg = apiDocs.packages[packageSlug];
      if (!pkg) return null;
      return {
        ...pkg,
        exports: [...pkg.exports],
        modules: pkg.modules.map((mod) => ({ ...mod, exports: [...mod.exports] })),
      };
    },

    getExportUrls(): string[] {
      return apiDocs.allExports.map((exp) => exp.path);
    },

    getPackageUrls(): string[] {
      return Object.values(apiDocs.packages).map((pkg) => buildUrl(pkg.slug));
    },

    getAllPrerenderUrls(): string[] {
      return [
        ...new Set([
          ...Object.values(apiDocs.packages).map((pkg) => buildUrl(pkg.slug)),
          ...apiDocs.allExports.map((exp) => exp.path),
        ]),
      ];
    },

    getRehypePlugins(): Plugin[] {
      if (!rehypePlugins) {
        throw new Error(
          'getRehypePlugins() requires documents to be provided in TypedocContextOptions. ' +
            'Pass TypeDoc JSON documents when creating the context.'
        );
      }
      return rehypePlugins;
    },

    getTypeRef(exp: ApiExport) {
      return typeRefMap.get(exp);
    },
  };
}
