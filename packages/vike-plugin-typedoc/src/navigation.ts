import type { ApiDocs, NavigationItem } from './types.js';

/**
 * Build navigation items for the sidebar from API docs.
 * Groups exports by package, with individual export links as children.
 */
export function buildApiNavigation(
  docs: ApiDocs
): NavigationItem[] {
  const items: NavigationItem[] = [];

  for (const pkg of Object.values(docs.packages)) {
    const children: NavigationItem[] = pkg.exports.map((exp) => ({
      title: exp.name,
      path: exp.path,
    }));

    items.push({
      title: pkg.name,
      path: '',
      children,
    });
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}
