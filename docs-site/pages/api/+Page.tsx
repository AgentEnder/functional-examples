import { useData } from 'vike-react/useData';
import { DimensionLine } from '../../components/DimensionLine';
import { Link } from '../../components/Link';
import { SpecPanel } from '../../components/SpecPanel';
import type { ApiData } from './+data.js';

export default function ApiPage() {
  const { packages } = useData<ApiData>();

  return (
    <div>
      <DimensionLine label="API REFERENCE" length={250} className="mb-4" />
      <h1 className="text-3xl font-heading text-bp-line-bright mb-3">
        API REFERENCE
      </h1>
      <p className="text-bp-line-dim mb-8 max-w-2xl">
        Browse the packages that make up the functional-examples toolkit. Each
        can be installed independently.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packages.map((pkg) => (
          <Link
            key={pkg.dirName}
            href={`/api/${pkg.dirName}`}
            className="block no-underline"
          >
            <SpecPanel
              label="PACKAGE"
              revision={`v${pkg.version}`}
              footer={[{ key: 'NPM', value: pkg.npmName }]}
              className="h-full hover:bg-bp-surface/30 transition-colors"
            >
              <h3 className="text-base text-bp-line mb-2 normal-case tracking-normal font-mono">
                {pkg.npmName}
              </h3>
              {pkg.description && (
                <p className="text-sm text-bp-line-dim leading-relaxed">
                  {pkg.description}
                </p>
              )}
            </SpecPanel>
          </Link>
        ))}
      </div>
    </div>
  );
}
