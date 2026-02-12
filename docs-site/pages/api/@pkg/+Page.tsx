import { useData } from 'vike-react/useData';
import { useApiPackage } from 'vike-plugin-typedoc/client';
import { ApiPackageLanding } from '../../../components/ApiPackageLanding';
import { DimensionLine } from '../../../components/DimensionLine';
import { Link } from '../../../components/Link';
import type { PackageDetailData } from './+data.js';

export default function PackageDetail() {
  const { pkg } = useData<PackageDetailData>();
  const { apiPackage } = useApiPackage();

  if (!pkg) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-heading text-bp-line-bright mb-4">
          PACKAGE NOT FOUND
        </h1>
        <p className="text-bp-line-dim">No package was found.</p>
        <Link
          href="/api"
          className="inline-block mt-6 text-bp-accent hover:text-bp-line transition-colors font-heading text-sm tracking-wider"
        >
          &larr; BACK TO API
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bp-annotation mb-4 flex items-center gap-2">
        <Link
          href="/api"
          className="text-bp-line-dim hover:text-bp-line transition-colors"
        >
          API
        </Link>
        <span className="text-bp-line-dim/50">/</span>
        <span className="text-bp-line">{pkg.dirName}</span>
      </div>

      <DimensionLine
        label={pkg.dirName.toUpperCase()}
        length={200}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl text-bp-line-bright mb-2 font-mono">
          {pkg.npmName}
        </h1>
        {pkg.description && (
          <p className="text-bp-line-dim max-w-2xl mb-4">{pkg.description}</p>
        )}

        {/* Install command */}
        <div className="inline-block bg-bp-surface/30 border border-bp-line-dim/20 rounded px-3 py-1.5 mb-4">
          <code className="text-sm text-bp-line font-mono">
            npm install {pkg.npmName}
          </code>
        </div>

        {/* Badges */}
        <div className="flex gap-3 flex-wrap">
          <span className="bp-stamp text-bp-line-dim">v{pkg.version}</span>
          <a
            href={pkg.npmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bp-stamp text-bp-accent hover:text-bp-line transition-colors"
          >
            NPM
          </a>
          <a
            href={pkg.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bp-stamp text-bp-accent hover:text-bp-line transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* Rendered README */}
      {pkg.renderedHtml ? (
        <div className="max-w-4xl">
          <div
            className="prose-blueprint"
            dangerouslySetInnerHTML={{ __html: pkg.renderedHtml }}
          />
        </div>
      ) : (
        <p className="text-bp-line-dim">
          No README available for this package.
        </p>
      )}

      {/* API Exports from TypeDoc */}
      {apiPackage && apiPackage.exports.length > 0 && (
        <ApiPackageLanding apiPackage={apiPackage} />
      )}
    </div>
  );
}
