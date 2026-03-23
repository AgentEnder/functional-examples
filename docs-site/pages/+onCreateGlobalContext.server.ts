import { loadTypedocContext } from 'vike-plugin-typedoc/server';
import type { GlobalContextServer } from 'vike/types';
import {
  buildDocsNavigation,
  hydrateGuides,
  scanCategories,
  scanDocs,
  type DocPage,
  type NavigationItem,
} from '../server/utils/docs';
import { loadExamples, type SiteExample } from '../server/utils/examples';
import { configureRehypeTypedoc, configureRemarkCodeProps } from '../server/utils/markdown.js';
import { scanPackages, type PackageInfo } from '../server/utils/packages';

function sortNavigationItems(items: NavigationItem[]): NavigationItem[] {
  for (const item of items) {
    if (item.children) {
      item.children = sortNavigationItems(item.children);
    }
  }
  return items.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });
}

export async function onCreateGlobalContext(
  context: Partial<GlobalContextServer>
): Promise<void> {
  // Phase 1: Read TypeDoc context (loaded by the vike-plugin-typedoc extension)
  // and configure rehype-typedoc so inline code auto-linking works.
  const typedoc = await loadTypedocContext(context);
  configureRehypeTypedoc(typedoc.getRehypePlugins());
  configureRemarkCodeProps({
    resolveSignature: (symbolName, pkg) => {
      const exports = typedoc.apiDocs.allExports;
      const matches = exports.filter((exp) => exp.name === symbolName);

      if (pkg) {
        const match = matches.find((exp) => exp.package === pkg);
        return match?.signature;
      }

      if (matches.length === 1) return matches[0].signature;
      if (matches.length > 1) {
        throw new Error(
          `Ambiguous ::typedoc symbol "${symbolName}" found in packages: ${matches.map((m) => m.package).join(', ')}. Use pkg attribute to disambiguate.`
        );
      }
      return undefined;
    },
  });

  // Phase 2: Load all content in parallel.
  // renderMarkdown calls within these loaders will now
  // automatically apply typedoc symbol links.
  const [
    { siteExamples: examples, scannedExamples },
    categories,
    packageList,
  ] = await Promise.all([loadExamples(), scanCategories(), scanPackages()]);

  // Scan docs with category metadata for section assignment
  const rawDocs = await scanDocs(categories);

  // Hydrate guide pages: expand Eta example references and render to HTML
  const docs = await hydrateGuides(rawDocs, scannedExamples);

  const docsNavigation = buildDocsNavigation(docs, categories);

  const packages = Object.fromEntries(
    packageList.map((pkg) => [pkg.dirName, pkg])
  );

  const navigation: NavigationItem[] = [
    ...docsNavigation,
    {
      title: 'Examples',
      path: '/examples',
      order: 50,
      children: examples.map((ex) => ({
        title: ex.title,
        path: `/examples/${ex.id}`,
      })),
    },
    {
      title: 'API',
      path: '/api',
      order: 100,
      children: [
        ...packageList.map((pkg) => {
          // Merge TypeDoc nav items into package nav
          const apiNav = typedoc.navigation.find(
            (item) => item.path === `/api/${pkg.dirName}`
          );
          return {
            title: pkg.npmName,
            path: `/api/${pkg.dirName}`,
            children: apiNav?.children,
          };
        }),
      ],
    },
  ];

  (context as Record<string, unknown>).examples = Object.fromEntries(
    examples.map((ex) => [ex.id, ex])
  );
  (context as Record<string, unknown>).docs = Object.fromEntries(
    docs.map((d) => [d.slug, d])
  );
  (context as Record<string, unknown>).packages = packages;
  (context as Record<string, unknown>).navigation =
    sortNavigationItems(navigation);
}

// Augment Vike's global namespace for type-safe context access
declare global {
  namespace Vike {
    interface GlobalContextServer {
      examples: Record<string, SiteExample>;
      docs: Record<string, DocPage>;
      packages: Record<string, PackageInfo>;
      navigation: NavigationItem[];
    }
    interface GlobalContextClient {
      navigation: NavigationItem[];
    }
  }
}
