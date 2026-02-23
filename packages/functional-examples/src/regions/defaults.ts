/**
 * Default region marker patterns for common file extensions.
 *
 * Each entry maps a file extension to an array of regex patterns (RegExp or string).
 * `{token}` in the pattern source is substituted at parse time with the configured
 * startTag or endTag. The single capturing group `([\w-]+)` captures the region ID.
 *
 * Multiple patterns per extension support multiple comment styles.
 */

// #region default-extension-map
// Shared pattern arrays, referenced by multiple extensions below.
const C_LINE_AND_BLOCK = [/^\s*\/\/\s*{token}\s+([\w-]+)\s*$/, /^\s*\/\*\s*{token}\s+([\w-]+)\s*\*\/\s*$/];
const C_LINE            = [/^\s*\/\/\s*{token}\s+([\w-]+)\s*$/];
const HASH_LINE         = [/^\s*#\s*{token}\s+([\w-]+)\s*$/];
const HTML_COMMENT      = [/^\s*<!--\s*{token}\s+([\w-]+)\s*-->\s*$/];
const CSS_BLOCK         = [/^\s*\/\*\s*{token}\s+([\w-]+)\s*\*\/\s*$/];
const DOUBLE_DASH       = [/^\s*--\s*{token}\s+([\w-]+)\s*$/];

export const DEFAULT_REGION_EXTENSION_MAP: Record<string, (string | RegExp)[]> = Object.fromEntries(
  ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'].map(ext => [`.${ext}`, C_LINE_AND_BLOCK]).concat(
  ['py', 'rb', 'sh', 'bash', 'zsh', 'fish', 'ps1'].map(ext => [`.${ext}`, HASH_LINE]),
  ['html', 'xml'].map(ext => [`.${ext}`, HTML_COMMENT]),
  ['css', 'scss'].map(ext => [`.${ext}`, CSS_BLOCK]),
  ['sql', 'lua'].map(ext => [`.${ext}`, DOUBLE_DASH]),
  ['go', 'rs', 'swift', 'cs'].map(ext => [`.${ext}`, C_LINE])
));
// #endregion default-extension-map
