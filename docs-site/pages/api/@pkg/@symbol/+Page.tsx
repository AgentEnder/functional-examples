import { useApiExport } from 'vike-plugin-typedoc/client';
import { ApiExportPage } from '../../../../components/ApiExportPage';
import { DimensionLine } from '../../../../components/DimensionLine';
import { Link } from '../../../../components/Link';

export default function SymbolDetail() {
  const { apiExport, packageSlug, packageName } = useApiExport();

  if (!apiExport) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-heading text-bp-line-bright mb-4">
          SYMBOL NOT FOUND
        </h1>
        <p className="text-bp-line-dim">
          The requested API symbol was not found.
        </p>
        <Link
          href={`/api/${packageSlug}`}
          className="inline-block mt-6 text-bp-accent hover:text-bp-line transition-colors font-heading text-sm tracking-wider"
        >
          &larr; BACK TO {packageName.toUpperCase()}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <DimensionLine
        label={apiExport.name.toUpperCase()}
        length={200}
        className="mb-4"
      />
      <ApiExportPage
        apiExport={apiExport}
        packagePath={`/api/${packageSlug}`}
        packageName={packageName}
      />
    </div>
  );
}
