import { usePageContext } from 'vike-react/usePageContext';
import { ExampleCard } from '../../components/ExampleCard';
import { DimensionLine } from '../../components/DimensionLine';
import type { SiteExample } from '../../server/utils/examples';

export default function ExamplesIndex() {
  const pageContext = usePageContext();
  const examples = Object.values(
    ((pageContext as unknown as Record<string, unknown>).examples ?? {}) as Record<string, SiteExample>
  );

  return (
    <div>
      <div className="mb-8">
        <DimensionLine label="EXAMPLES" length={200} className="mb-4" />
        <h1 className="text-3xl font-heading text-bp-line-bright mb-3">EXAMPLES</h1>
        <p className="text-bp-line-dim max-w-2xl">
          Browse real-world examples demonstrating different features of
          functional-examples. Each example is a complete project you can
          explore file-by-file.
        </p>
      </div>

      {examples.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {examples.map((example) => (
            <ExampleCard key={example.id} example={example} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-bp-line-dim">
          <p className="bp-annotation">No examples found</p>
          <p className="mt-2 text-sm">
            Run <code className="text-bp-accent">npx nx run-many -t build</code> to build packages first.
          </p>
        </div>
      )}
    </div>
  );
}
