import { useData } from 'vike-react/useData';
import { DimensionLine } from '../../components/DimensionLine';
import { Link } from '../../components/Link';
import { SpecPanel } from '../../components/SpecPanel';
import type { DocsData } from './+data.js';

export default function DocsPage() {
  const { docs } = useData<DocsData>();

  // Group docs by section, sorted by order
  const sections = new Map<string, typeof docs>();
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
                <Link
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className="block no-underline"
                >
                  <SpecPanel
                    label={section.toUpperCase()}
                    className="h-full hover:bg-bp-surface/30 transition-colors"
                  >
                    <h3 className="text-base font-heading text-bp-line mb-2 normal-case tracking-normal">
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-sm text-bp-line-dim leading-relaxed">
                        {doc.description}
                      </p>
                    )}
                  </SpecPanel>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
