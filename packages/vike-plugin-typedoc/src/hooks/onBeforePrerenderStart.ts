/**
 * Vike extension hook — called automatically during pre-rendering to
 * generate the list of API URLs that need static HTML.
 *
 * Reads the TypedocContext previously stored on the global context by
 * the `onCreateGlobalContext` hook and returns all package + export URLs.
 */

import { getGlobalContext } from 'vike/server';
import type { GlobalContextServer } from 'vike/types';

export async function onBeforePrerenderStart(): Promise<string[]> {
  // Safe cast: this hook only runs server-side during prerendering
  const globalContext = (await getGlobalContext()) as GlobalContextServer;
  if (globalContext.isClientSide) {
    throw new Error('Prerender should never run client side.');
  }
  const typedocContext = globalContext.$$VIKE_PLUGIN_TYPEDOC$$;
  if (!typedocContext) return [];
  return typedocContext.getAllPrerenderUrls();
}
