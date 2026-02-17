/**
 * ---
 * id: region-markers
 * title: Region Markers Demo
 * ---
 */

// #region setup
const config = loadConfig();
const scanner = createScanner(config);
// #endregion

// #region execution
const result = await scanner.scan();
console.log(result.examples);
// #endregion
