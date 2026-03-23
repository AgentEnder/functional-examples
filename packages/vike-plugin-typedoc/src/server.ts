import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { TypeDocDocument } from 'rehype-typedoc';
import { GlobalContextServer, PageContextServer } from 'vike/types';
import {
  createTypedocContext,
  type TypedocContext,
  type TypedocContextOptions,
} from './context.js';
import { deserializeTypedocJson } from './deserialize.js';
import type { LinkedApiExport } from './types.js';
import type { ApiPackage } from './types.js';

const GLOBAL_KEY = '$$VIKE_PLUGIN_TYPEDOC$$';
const DATA_KEY = '$$VIKE_PLUGIN_TYPEDOC$$';

/** Module-level inflight promise to prevent concurrent loads */
let _inflight: Promise<TypedocContext> | undefined;

export interface LoadTypedocContextOptions extends TypedocContextOptions {
  /** Directory with *.json TypeDoc output files */
  typedocDir: string;
  /**
   * Map slug -> npm package name (e.g. `{ devkit: '@functional-examples/devkit' }`).
   * If a slug is missing from the map but `packagesDir` is set, the npm name
   * is read from `<packagesDir>/<slug>/package.json`.
   */
  packageNames?: Record<string, string>;
  /**
   * Directory containing package directories. Used to auto-discover npm names
   * from `<packagesDir>/<slug>/package.json` when not in `packageNames`.
   */
  packagesDir?: string;

  /**
   * Ignores some typedoc packages. Should be the package name
   * as defined by .typedoc/[package].json
   */
  exclude?: string[];
}

/**
 * Load TypeDoc JSON files from disk and create a TypedocContext.
 *
 * This is the pure loading function -- it does not mutate any global state.
 * Used internally by the Vike extension hook and by `loadTypedocContext`.
 *
 * @param options - Where to find TypeDoc JSON files and package metadata
 * @returns The created TypedocContext
 */
export async function loadTypedocContextInternal(
  options: LoadTypedocContextOptions
): Promise<TypedocContext> {
  const {
    typedocDir,
    packageNames = {},
    packagesDir,
    ...contextOptions
  } = options;

  let entries: string[];
  try {
    entries = await readdir(typedocDir);
  } catch {
    console.warn(
      '[vike-plugin-typedoc] No typedoc directory found at',
      typedocDir
    );
    return await createTypedocContext([], contextOptions);
  }

  const packages: ApiPackage[] = [];
  const documents: TypeDocDocument[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const slug = basename(entry, '.json');
    if (contextOptions.exclude?.includes(slug)) {
      continue;
    }
    let npmName = packageNames[slug];

    // Auto-discover from package.json if not provided
    if (!npmName && packagesDir) {
      try {
        const pkgJson = JSON.parse(
          await readFile(join(packagesDir, slug, 'package.json'), 'utf-8')
        );
        npmName = pkgJson.name || slug;
      } catch {
        npmName = slug;
      }
    }
    if (!npmName) npmName = slug;

    try {
      const jsonContent = await readFile(join(typedocDir, entry), 'utf-8');
      const json = JSON.parse(jsonContent);
      packages.push(deserializeTypedocJson(json, slug, npmName));
      documents.push({ packageSlug: slug, json });
      console.log(`[typedoc] Loaded ${slug} (${npmName})`);
    } catch (err) {
      console.warn(
        `[typedoc] Failed to load ${entry}:`,
        (err as Error).message
      );
    }
  }

  return await createTypedocContext(packages, { ...contextOptions, documents });
}

/**
 * Load TypeDoc JSON files from disk, create a TypedocContext, and store it
 * on the global context under the `$$VIKE_PLUGIN_TYPEDOC$$` key.
 *
 * Call this in `+onCreateGlobalContext.server.ts` for manual setup,
 * or use the `vike-plugin-typedoc/config` extension for automatic setup.
 *
 * @param context - The Vike global context object (will be mutated)
 * @param options - Where to find TypeDoc JSON files and package metadata
 * @returns The created TypedocContext (also stored on `context`)
 */
export async function loadTypedocContext(
  context: Partial<GlobalContextServer>,
  options: LoadTypedocContextOptions | undefined = context.config?.typedoc
): Promise<TypedocContext> {
  if (!options) {
    throw new Error(
      'No options provided for loadTypedocContext. ' +
        'Make sure to pass options or set config.typedoc in your Vike config.'
    );
  }
  // Fast path: already resolved and stored on global context
  const alreadyLoaded = context[GLOBAL_KEY];
  if (alreadyLoaded) {
    return alreadyLoaded;
  }
  // Deduplicate concurrent callers: if a load is already inflight, await it
  if (_inflight) {
    const ctx = await _inflight;
    context[GLOBAL_KEY] = ctx;
    return ctx;
  }
  // Automatically inject baseServer from Vike when baseUrl isn't explicitly set
  const optionsWithBase: LoadTypedocContextOptions =
    options.baseUrl != null
      ? options
      : { ...options, baseUrl: context.baseServer ?? '/' };
  // Store the promise immediately so concurrent callers find it
  _inflight = loadTypedocContextInternal(optionsWithBase);
  try {
    const ctx = await _inflight;
    context[GLOBAL_KEY] = ctx;
    return ctx;
  } finally {
    _inflight = undefined;
  }
}

/**
 * Retrieve the TypedocContext from a page's global context.
 *
 * Throws if the TypeDoc context was not loaded (either via the extension
 * or by calling `loadTypedocContext` manually).
 */
export function getTypedocContext(
  pageContext: PageContextServer
): TypedocContext {
  const ctx = pageContext.globalContext[GLOBAL_KEY] as
    | TypedocContext
    | undefined;
  if (!ctx) {
    throw new Error(
      'TypedocContext not found on global context. ' +
        'Either add vike-plugin-typedoc/config to your extends array, ' +
        'or call loadTypedocContext() in +onCreateGlobalContext.server.ts.'
    );
  }
  return ctx;
}

/** Data shape for package detail pages */
export interface ApiPackageData {
  apiPackage: ApiPackage | null;
  packageSlug: string;
  packageName: string;
}

/** Data shape for export/symbol detail pages */
export interface ApiExportData {
  apiExport: LinkedApiExport | null;
  apiPackage: ApiPackage | null;
  packageSlug: string;
  packageName: string;
}

/**
 * Build page data for a package detail page.
 *
 * Spread the result into your `+data.ts` return value:
 * ```ts
 * return { ...withApiPackage(pageContext, pkgSlug), myCustomData };
 * ```
 */
export function withApiPackage(
  pageContext: PageContextServer,
  packageSlug: string
): { [key: string]: unknown } {
  const typedoc = getTypedocContext(pageContext);
  const apiPackage = typedoc.getPackage(packageSlug);

  const data: ApiPackageData = {
    apiPackage,
    packageSlug,
    packageName: apiPackage?.name ?? packageSlug,
  };

  return { [DATA_KEY]: data };
}

/**
 * Build page data for an export/symbol detail page.
 *
 * Spread the result into your `+data.ts` return value:
 * ```ts
 * return withApiExport(pageContext, pkgSlug, symbolSlug);
 * ```
 */
export function withApiExport(
  pageContext: PageContextServer,
  packageSlug: string,
  symbolSlug: string
): { [key: string]: unknown } {
  const typedoc = getTypedocContext(pageContext);
  const apiPackage = typedoc.getPackage(packageSlug);
  const apiExport = apiPackage
    ? typedoc.getLinkedExport(packageSlug, symbolSlug)
    : null;

  const data: ApiExportData = {
    apiExport,
    apiPackage,
    packageSlug,
    packageName: apiPackage?.name ?? packageSlug,
  };

  return { [DATA_KEY]: data };
}
