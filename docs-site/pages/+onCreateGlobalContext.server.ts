import type { GlobalContextServer } from 'vike/types';
import {
  buildDocsNavigation,
  hydrateGuides,
  scanDocs,
  type DocPage,
  type NavigationItem,
} from '../server/utils/docs';
import { loadExamples, type SiteExample } from '../server/utils/examples';

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
  const [{ siteExamples: examples, scannedExamples }, rawDocs] =
    await Promise.all([loadExamples(), scanDocs()]);

  // Hydrate guide pages: expand Eta example references and render to HTML
  const docs = await hydrateGuides(rawDocs, scannedExamples);

  const docsNavigation = buildDocsNavigation(docs);

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
    },
  ];

  (context as Record<string, unknown>).examples = Object.fromEntries(
    examples.map((ex) => [ex.id, ex])
  );
  (context as Record<string, unknown>).docs = Object.fromEntries(
    docs.map((d) => [d.slug, d])
  );
  (context as Record<string, unknown>).navigation =
    sortNavigationItems(navigation);
}

// Augment Vike's global namespace for type-safe context access
declare global {
  namespace Vike {
    interface GlobalContextServer {
      examples: Record<string, SiteExample>;
      docs: Record<string, DocPage>;
      navigation: NavigationItem[];
    }
    interface GlobalContextClient {
      navigation: NavigationItem[];
    }
  }
}
