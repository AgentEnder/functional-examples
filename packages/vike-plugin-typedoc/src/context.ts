import type { RehypeTypedocOptions, SymbolEntry } from 'rehype-typedoc';
import type { PluggableList } from 'unified';
import { linkifyApiExport, linkifyType } from './linkify.js';
import type { LinkedApiExport } from './linkify.js';
import {
  buildMarkdownProcessor,
  renderExportMarkdown,
  type RenderedExportMarkdown,
} from './markdown.js';
import { buildApiNavigation } from './navigation.js';
import { combineApiDocs } from './parser.js';
import { buildSymbolsMap } from './symbols.js';
import type { ApiDocs, ApiPackage, NavigationItem } from './types.js';

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
   * @example '/docs/api' → URLs like `/docs/api/devkit/parse-json`
   */
  basePath?: string;

  /**
   * Deployment base URL to prepend to rendered HTML links.
   *
   * When set, `buildLink` (used by rehype-typedoc for inline type links and
   * rendered markdown) prepends this base to every route-relative path.
   * Stored paths (`exp.path`, `navItem.path`) and prerender URLs are
   * **not** affected — they remain route-relative.
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
}

export interface TypedocContext {
  /** All parsed API documentation */
  apiDocs: ApiDocs;
  /** Symbols map (for rehype-typedoc or custom use) */
  symbolsMap: Map<string, SymbolEntry>;
  /** Navigation items for sidebar */
  navigation: NavigationItem[];
  /** Pre-built options to pass to rehype-typedoc */
  rehypeOptions: RehypeTypedocOptions;
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
}

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

/**
 * Create a TypedocContext from pre-parsed packages.
 *
 * This is the low-level API — use `loadTypedocContext` for the common case
 * of loading TypeDoc JSON files from disk.
 *
 * The function is async because it eagerly pre-renders all markdown fields
 * (descriptions, remarks, examples) through a unified pipeline so that
 * `getLinkedExport()` can return fully-rendered HTML synchronously.
 */
export async function createTypedocContext(
  packages: ApiPackage[],
  options: TypedocContextOptions = {}
): Promise<TypedocContext> {
  const basePath = options.basePath ?? '/api';
  const isSinglePackage = packages.length === 1;

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
  const symbolsMap = buildSymbolsMap(apiDocs);
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

  const buildLink = (symbol: { path?: string }) =>
    symbol.path ? applyBaseUrl(symbol.path) : undefined;

  const rehypeOptions: RehypeTypedocOptions = {
    symbols: symbolsMap,
    buildLink,
  };

  // Build the markdown processor and pre-render all exports
  const processor = buildMarkdownProcessor(
    rehypeOptions,
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
        exp.signature,
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
    symbolsMap,
    navigation,
    rehypeOptions,
    baseUrl,
    applyBaseUrl,

    getLinkedExport(packageSlug: string, symbolSlug: string): LinkedApiExport | null {
      const apiPackage = apiDocs.packages[packageSlug];
      if (!apiPackage) return null;

      const rawExport = apiPackage.exports.find((e) => e.slug === symbolSlug);
      if (!rawExport) return null;

      const linked = linkifyApiExport(rawExport, (typeStr) =>
        linkifyType(typeStr, symbolsMap, buildLink)
      );

      // Merge pre-rendered markdown HTML (code block linkification is now
      // handled by rehypeTypedocCodeBlocks in the unified pipeline)
      const md = renderedMarkdown.get(markdownCacheKey(packageSlug, symbolSlug));
      if (md) {
        if (md.signatureCodeHtml) linked.signatureCodeHtml = md.signatureCodeHtml;
        if (md.returnTypeCodeHtml) linked.returnTypeCodeHtml = md.returnTypeCodeHtml;
        if (md.descriptionHtml) linked.descriptionHtml = md.descriptionHtml;
        if (md.remarksHtml) linked.remarksHtml = md.remarksHtml;
        if (md.examplesHtml) linked.examplesHtml = md.examplesHtml;
      }

      return linked;
    },

    getPackage(packageSlug: string): ApiPackage | null {
      return apiDocs.packages[packageSlug] ?? null;
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
  };
}
