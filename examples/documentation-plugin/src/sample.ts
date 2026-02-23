// ---
// id: doc-sample
// title: Sample for Documentation
// description: A simple example demonstrating documentation generation
// tags:
//   - documentation
//   - sample
// ---

// #_region setup
import { readFileSync } from 'node:fs';

/**
 * Read and parse a configuration file.
 */
export function loadConfig(path: string): Record<string, unknown> {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}
// #_endregion setup

// #_region usage
// Load configuration from a JSON file
const config = loadConfig('config.json');
console.log('Loaded config:', config);
// #_endregion usage
