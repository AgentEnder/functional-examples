/**
 * Vike extension hook — called automatically when `vike-plugin-typedoc/config`
 * is added to the `extends` array.
 *
 * Reads the `typedoc` config key from `globalContext.config` and loads
 * TypeDoc data onto `globalContext.$$VIKE_PLUGIN_TYPEDOC$$`.
 *
 * Uses `loadTypedocContext` (the cache-aware API) so that if the consumer's
 * own `onCreateGlobalContext` already loaded the context, this hook is a no-op.
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
  const typedocOptions = config?.typedoc;

  if (!typedocOptions) {
    console.warn(
      '[vike-plugin-typedoc] No `typedoc` config found. ' +
        'Add a `typedoc` key to your Vike config with at least `typedocDir`.'
    );
    return;
  }

  // loadTypedocContext checks the cache and auto-injects baseServer,
  // so this is safe to call even if the consumer already loaded the context.
  const { loadTypedocContext } = await import('../server.js');
  await loadTypedocContext(globalContext);
}
