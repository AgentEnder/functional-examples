import type { Config } from 'functional-examples';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';

const config: Config = {
  plugins: [
    createJavaScriptPlugin(),
    createYamlManifestPlugin(),
  ],
  scan: {
    include: ['**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export default config;
