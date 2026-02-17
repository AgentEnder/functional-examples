// #_region plugin-config
import type { Plugin } from 'functional-examples';
import { createTomlExtractor } from './toml-extractor.js';

const tomlPlugin: Plugin = {
  name: 'toml',
  extensions: ['.toml'],
  extractor: createTomlExtractor(),
};

export default {
  plugins: [tomlPlugin],
  scan: { include: ['examples/**/*'] },
};
// #_endregion plugin-config
