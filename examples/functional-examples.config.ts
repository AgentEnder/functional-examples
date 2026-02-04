import type { Config } from 'functional-examples';
import { createFrontmatterExtractor } from '@functional-examples/extractor-frontmatter';
import { createYamlManifestExtractor } from '@functional-examples/yaml-manifest';

const config: Config = {
  extractors: [
    createFrontmatterExtractor({ extensions: ['.ts', '.js'] }),
    createYamlManifestExtractor(),
  ],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;
