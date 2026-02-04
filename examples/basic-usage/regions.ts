/**
 * Extracting code regions from files
 */
import { parseRegions, extractRegion, listRegions } from 'functional-examples';

// #region example-code
const exampleCode = `
// This is some TypeScript code
// #region setup
const db = createConnection();
const cache = createCache();
// #endregion setup

// #region main
async function processData() {
  const data = await db.query('SELECT * FROM users');
  return data.map(user => user.name);
}
// #endregion main
`;
// #endregion example-code

// #region usage
// List all regions in the code
const regionIds = listRegions(exampleCode, { extension: 'ts' });
console.log('Regions found:', regionIds); // ['setup', 'main']

// Parse all regions
const regions = parseRegions(exampleCode, { extension: 'ts' });
console.log('Setup code:', regions['setup'].content);

// Extract a specific region
const mainCode = extractRegion(exampleCode, 'main', { extension: 'ts' });
console.log('Main code:', mainCode);
// #endregion usage
