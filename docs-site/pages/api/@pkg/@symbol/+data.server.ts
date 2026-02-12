import { withApiExport } from 'vike-plugin-typedoc/server';
import type { PageContextServer } from 'vike/types';

export type SymbolDetailData = {
  _vike_plugin_typedoc: unknown;
};

export function data(pageContext: PageContextServer): SymbolDetailData {
  const { pkg: packageSlug, symbol: symbolSlug } = pageContext.routeParams;
  return withApiExport(
    pageContext,
    packageSlug,
    symbolSlug
  ) as SymbolDetailData;
}
