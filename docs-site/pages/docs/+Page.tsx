import { usePageContext } from 'vike-react/usePageContext';
import { DimensionLine } from '../../components/DimensionLine';
import { Link } from '../../components/Link';
import type { DocPage } from '../../server/utils/docs';

export default function DocsPage() {
  const pageContext = usePageContext();
  const docsMap = ((pageContext as unknown as Record<string, unknown>).docs ??
    {}) as Record<string, DocPage>;

  // Group docs by section, sorted by order
  const docs = Object.values(docsMap).sort((a, b) => a.order - b.order);
  const sections = new Map<string, DocPage[]>();
  for (const doc of docs) {
    const list = sections.get(doc.section) ?? [];
    list.push(doc);
    sections.set(doc.section, list);
  }

  return (
    <div>
      <DimensionLine label="DOCUMENTATION" length={250} className="mb-4" />
      <h1 className="text-3xl font-heading text-bp-line-bright mb-6">DOCUMENTATION</h1>

      <div className="space-y-6">
        <p className="text-bp-line-dim">
          Welcome to the functional-examples documentation. Browse the
          sections below to learn about configuration, plugins,
          scanning, and more.
        </p>

        {Array.from(sections.entries()).map(([section, pages]) => (
          <div key={section} className="mt-8">
            <h2 className="text-sm font-heading text-bp-line-dim tracking-wider mb-4">
              {section.toUpperCase()}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pages.map((doc) => (
                <DocLink
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  title={doc.title}
                  description={doc.description}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="block p-4 border border-bp-line-dim/25 rounded hover:border-bp-line-dim/50 hover:bg-bp-surface/20 transition-all group"
    >
      <h3 className="text-sm font-heading text-bp-line group-hover:text-bp-line-bright transition-colors mb-1">
        {title}
      </h3>
      <p className="text-xs text-bp-line-dim">{description}</p>
    </Link>
  );
}
