// prettier-ignore-start
/**
 * Default region marker patterns for common file extensions.
 *
 * Each entry maps a file extension to an array of regex patterns (RegExp or string).
 * `{token}` in the pattern source is substituted at parse time with the configured
 * startTag or endTag. The single capturing group `(\w+)` captures the region ID.
 *
 * Multiple patterns per extension support multiple comment styles.
 */
// region default-extension-map
export const DEFAULT_REGION_EXTENSION_MAP: Record<string, (string | RegExp)[]> = {
  // JavaScript / TypeScript family — line comment and block comment
  '.ts':   [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.tsx':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.js':   [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.jsx':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.mjs':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.cjs':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.mts':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.cts':  [/\/\/\s*{token}\s+(\w+)/, /\/\*\s*{token}\s+(\w+)\s*\*\//],
  // Python / Ruby / Shell — hash line comment
  '.py':   [/#\s*{token}\s+(\w+)/],
  '.rb':   [/#\s*{token}\s+(\w+)/],
  '.sh':   [/#\s*{token}\s+(\w+)/],
  // HTML / XML — block comment
  '.html': [/<!--\s*{token}\s+(\w+)\s*-->/],
  '.xml':  [/<!--\s*{token}\s+(\w+)\s*-->/],
  // CSS / SCSS — block comment
  '.css':  [/\/\*\s*{token}\s+(\w+)\s*\*\//],
  '.scss': [/\/\*\s*{token}\s+(\w+)\s*\*\//],
  // SQL / Lua — double-dash line comment
  '.sql':  [/--\s*{token}\s+(\w+)/],
  '.lua':  [/--\s*{token}\s+(\w+)/],
  // Go / Rust / Swift / C# — line comment
  '.go':   [/\/\/\s*{token}\s+(\w+)/],
  '.rs':   [/\/\/\s*{token}\s+(\w+)/],
  '.swift':[/\/\/\s*{token}\s+(\w+)/],
  '.cs':   [/\/\/\s*{token}\s+(\w+)/],
};
// endregion default-extension-map
