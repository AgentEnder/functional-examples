import { useData } from 'vike-react/useData';
import type { ApiExportData, ApiPackageData } from './server.js';

const DATA_KEY = '$$VIKE_PLUGIN_TYPEDOC$$';

/**
 * Read API package data from page data in a `+Page.tsx` component.
 *
 * Requires that `+data.ts` returns `withApiPackage()` from the server entry.
 */
export function useApiPackage(): ApiPackageData {
  const data = useData<Record<string, unknown>>();
  const pluginData = data[DATA_KEY] as ApiPackageData | undefined;
  if (!pluginData) {
    throw new Error(
      'No API package data found in page data. Ensure your +data.ts returns withApiPackage().'
    );
  }
  return pluginData;
}

/**
 * Read API export/symbol data from page data in a `+Page.tsx` component.
 *
 * Requires that `+data.ts` returns `withApiExport()` from the server entry.
 */
export function useApiExport(): ApiExportData {
  const data = useData<Record<string, unknown>>();
  const pluginData = data[DATA_KEY] as ApiExportData | undefined;
  if (!pluginData) {
    throw new Error(
      'No API export data found in page data. Ensure your +data.ts returns withApiExport().'
    );
  }
  return pluginData;
}
