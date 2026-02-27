import type { ApiDocs, NavigationItem } from './types.js';

/**
 * Build navigation items for the sidebar from API docs.
 * Groups exports by package, with individual export links as children.
 *
 * When `singlePackage` is true and exactly one package exists, the navigation
 * is flattened: export items appear at the top level without a package grouping
 * node.
 */
export function buildApiNavigation(
  docs: ApiDocs,
  options?: { singlePackage?: boolean }
): NavigationItem[] {
  const packages = Object.values(docs.packages);

  // Single-package: flatten children to top level (no package grouping node)
  if (options?.singlePackage && packages.length === 1) {
    const pkg = packages[0];
    return pkg.exports
      .map((exp) => ({
        title: exp.name,
        path: exp.path,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  // Multi-package: group by package (existing behavior)
  const items: NavigationItem[] = [];
  for (const pkg of packages) {
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
