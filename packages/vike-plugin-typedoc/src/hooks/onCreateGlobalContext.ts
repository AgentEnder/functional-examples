/**
 * Vike extension hook — called automatically when `vike-plugin-typedoc/config`
 * is added to the `extends` array.
 *
 * Reads the `typedoc` config key from `globalContext.config` and loads
 * TypeDoc data onto `globalContext._$$VIKE_PLUGIN_TYPEDOC$$`.
 *
 * The server module path is computed at runtime (not a string literal) to
 * prevent Vite/Rollup from statically analyzing and bundling it into the
 * client entry. This hook only executes server-side.
 */

import { GlobalContextServer } from 'vike/types';

export async function onCreateGlobalContext(
  globalContext: GlobalContextServer
): Promise<void> {
  const config = globalContext.config;
  const typedocOptions = config?.typedoc as
    | { typedocDir: string; packagesDir?: string; [k: string]: unknown }
    | undefined;

  if (!typedocOptions) {
    console.warn(
      '[vike-plugin-typedoc] No `typedoc` config found. ' +
        'Add a `typedoc` key to your Vike config with at least `typedocDir`.'
    );
    return;
  }

  const { loadTypedocContextInternal } = await import('../server.js');
  const ctx = await loadTypedocContextInternal(typedocOptions);
  globalContext.$$VIKE_PLUGIN_TYPEDOC$$ = ctx;
}
