import { useData } from 'vike-react/useData';
import { Link } from '../../../components/Link';
import { DimensionLine } from '../../../components/DimensionLine';
import type { DocDetailData } from './+data.js';

export default function DocDetail() {
  const { doc } = useData<DocDetailData>();

  if (!doc) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-heading text-bp-line-bright mb-4">
          PAGE NOT FOUND
        </h1>
        <p className="text-bp-line-dim">
          No documentation page found.
        </p>
        <Link
          href="/docs"
          className="inline-block mt-6 text-bp-accent hover:text-bp-line transition-colors font-heading text-sm tracking-wider"
        >
          &larr; BACK TO DOCS
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bp-annotation mb-4 flex items-center gap-2">
        <Link
          href="/docs"
          className="text-bp-line-dim hover:text-bp-line transition-colors"
        >
          DOCS
        </Link>
        <span className="text-bp-line-dim/50">/</span>
        <span className="text-bp-line">{doc.title}</span>
      </div>

      <DimensionLine label={doc.section.toUpperCase()} length={200} className="mb-4" />

      <div className="max-w-4xl">
        <div
          className="prose-blueprint"
          dangerouslySetInnerHTML={{ __html: doc.renderedHtml }}
        />
      </div>
    </div>
  );
}
