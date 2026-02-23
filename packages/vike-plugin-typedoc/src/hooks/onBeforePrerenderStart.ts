/**
 * Vike extension hook — called automatically during pre-rendering to
 * generate the list of API URLs that need static HTML.
 *
 * Reads the TypedocContext previously stored on the global context by
 * the `onCreateGlobalContext` hook and returns all package + export URLs.
 */

import { getGlobalContext } from 'vike/server';
import type { GlobalContextServer } from 'vike/types';

let hasEmitted = false;
let cachedUrls: string[] | undefined;

function normalizePrerenderUrl(url: string): string {
  if (url === '/') return '/';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function onBeforePrerenderStart(): Promise<string[]> {
  // Safe cast: this hook only runs server-side during prerendering
  const globalContext = (await getGlobalContext()) as GlobalContextServer;
  if (globalContext.isClientSide) {
    throw new Error('Prerender should never run client side.');
  }
  // Vike invokes onBeforePrerenderStart per page config; emit once per process run.
  if (hasEmitted) {
    return [];
  }
  const typedocContext = (globalContext as GlobalContextServer & {
    $$VIKE_PLUGIN_TYPEDOC$$?: { getAllPrerenderUrls(): string[] };
  }).$$VIKE_PLUGIN_TYPEDOC$$;
  if (!typedocContext) return [];
  if (!cachedUrls) {
    cachedUrls = [
      ...new Set(typedocContext.getAllPrerenderUrls().map(normalizePrerenderUrl)),
    ];
  }
  hasEmitted = true;
  return cachedUrls;
}
