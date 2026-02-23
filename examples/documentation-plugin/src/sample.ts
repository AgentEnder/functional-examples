// ---
// id: doc-sample
// title: Sample for Documentation
// description: A simple example demonstrating documentation generation
// tags:
//   - documentation
//   - sample
// ---

// #region setup
import { readFileSync } from 'node:fs';

/**
 * Read and parse a configuration file.
 */
export function loadConfig(path: string): Record<string, unknown> {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}
// #endregion setup

// #region usage
// Load configuration from a JSON file
const config = loadConfig('config.json');
console.log('Loaded config:', config);
// #endregion usage
