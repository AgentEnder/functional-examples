import { DimensionLine } from '../../components/DimensionLine';
import { SpecPanel } from '../../components/SpecPanel';

const packages = [
  {
    name: 'functional-examples',
    description: 'Core scanner, configuration, plugin system, and type generation',
    exports: ['scanExamples', 'loadConfig', 'resolveConfig', 'findConfigFile', 'mergeConfigs', 'validateConfig', 'parseRegions', 'extractRegion', 'readExampleFile', 'readExampleFiles', 'PluginRegistry', 'generateMetadataTypes'],
  },
  {
    name: '@functional-examples/devkit',
    description: 'Shared types and utility sub-entries (json, glob, yaml)',
    exports: ['Extractor', 'Plugin', 'Config', 'Example', 'ScannedExample', 'ExampleFile', 'ExtractorResult', 'parseJson (devkit/json)', 'glob (devkit/glob)', 'parseYaml (devkit/yaml)'],
  },
  {
    name: '@functional-examples/javascript',
    description: 'JavaScript/TypeScript extractor with frontmatter and region support',
    exports: ['createJavaScriptPlugin'],
  },
  {
    name: '@functional-examples/yaml-manifest',
    description: 'YAML manifest extractor for directory-based examples',
    exports: ['createYamlManifestPlugin'],
  },
  {
    name: '@functional-examples/test',
    description: 'Test runner plugin with TAP and pretty reporters',
    exports: ['createTestPlugin'],
  },
];

export default function ApiPage() {
  return (
    <div>
      <DimensionLine label="API REFERENCE" length={250} className="mb-4" />
      <h1 className="text-3xl font-heading text-bp-line-bright mb-3">API REFERENCE</h1>
      <p className="text-bp-line-dim mb-8 max-w-2xl">
        Public exports from each package in the functional-examples monorepo.
      </p>

      <div className="space-y-6">
        {packages.map((pkg) => (
          <SpecPanel
            key={pkg.name}
            label="PACKAGE"
            revision="1.0"
            footer={[{ key: 'EXPORTS', value: String(pkg.exports.length) }]}
          >
            <h3 className="text-base font-code text-bp-accent mb-2">{pkg.name}</h3>
            <p className="text-sm text-bp-line-dim mb-3">{pkg.description}</p>
            <div className="flex flex-wrap gap-2">
              {pkg.exports.map((exp) => (
                <code key={exp} className="text-xs px-2 py-0.5 bg-bp-paper/60 border border-bp-line-dim/15 rounded text-bp-line">
                  {exp}
                </code>
              ))}
            </div>
          </SpecPanel>
        ))}
      </div>
    </div>
  );
}
