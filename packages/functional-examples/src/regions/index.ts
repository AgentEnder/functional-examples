/**
 * Region extraction system for code examples
 */

export type {
  RegionInfo,
  RegionMap,
  RegionOptions,
  LanguageConfig,
} from './types.js';
export { LANGUAGE_CONFIGS, getLanguageConfig } from './languages.js';
export {
  parseRegions,
  extractRegion,
  stripRegionMarkers,
  listRegions,
} from './parser.js';
