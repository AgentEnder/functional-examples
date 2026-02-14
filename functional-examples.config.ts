import { createDocumentationPlugin } from '@functional-examples/documentation';
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest';
import type {
  Config,
  FileParseContext,
  ParsedRegion,
  Plugin,
} from 'functional-examples';

/**
 * Inline bash region parser plugin.
 *
 * Handles `# #_region name` / `# #_endregion name` markers in .sh/.bash files,
 * mirroring the JavaScript parser algorithm but with `#` comment prefix.
 */
const bashPlugin: Plugin = {
  name: 'bash',
  extensions: ['.sh', '.bash'],
  fileContentsParsers: [{
    name: 'bash-parser',
    parse(context: FileParseContext): FileParseContext {
      const startRe = /^[ \t]*#\s*#_region\s+(\S+)\s*$/;
      const endRe = /^[ \t]*#\s*#_endregion(?:\s+(\S+))?\s*$/;

      const lines = context.parsed.split('\n');
      const hunks: ParsedRegion[] = [];
      const outputLines: string[] = [];
      const regionStack: { id: string; startLine: number; lines: string[] }[] =
        [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const startMatch = line.match(startRe);
        if (startMatch) {
          regionStack.push({ id: startMatch[1], startLine: lineNum, lines: [] });
          continue;
        }

        const endMatch = line.match(endRe);
        if (endMatch) {
          const current = regionStack.pop();
          if (current) {
            hunks.push({
              id: current.id,
              content: current.lines.join('\n'),
              startLine: current.startLine,
              endLine: lineNum,
            });
          }
          continue;
        }

        outputLines.push(line);
        for (const region of regionStack) {
          region.lines.push(line);
        }
      }

      return { ...context, parsed: outputLines.join('\n'), hunks };
    },
  }],
};

/**
 * Inline JSON region parser plugin.
 *
 * Handles `"#_region name": true` / `"#_endregion name": true` key markers in
 * .json files. These are valid JSON keys that Node.js ignores, so package.json
 * files stay valid while still supporting region extraction for docs.
 */
const jsonRegionPlugin: Plugin = {
  name: 'json-regions',
  extensions: ['.json'],
  fileContentsParsers: [{
    name: 'json-region-parser',
    parse(context: FileParseContext): FileParseContext {
      const startRe = /^[ \t]*"#_region\s+(\S+)"\s*:\s*.+$/;
      const endRe = /^[ \t]*"#_endregion\s+(\S+)"\s*:\s*.+$/;

      const lines = context.parsed.split('\n');
      const hunks: ParsedRegion[] = [];
      const outputLines: string[] = [];
      const regionStack: { id: string; startLine: number; lines: string[] }[] =
        [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const startMatch = line.match(startRe);
        if (startMatch) {
          regionStack.push({ id: startMatch[1], startLine: lineNum, lines: [] });
          continue;
        }

        const endMatch = line.match(endRe);
        if (endMatch) {
          const current = regionStack.pop();
          if (current) {
            hunks.push({
              id: current.id,
              content: current.lines.join('\n'),
              startLine: current.startLine,
              endLine: lineNum,
            });
          }
          continue;
        }

        outputLines.push(line);
        for (const region of regionStack) {
          region.lines.push(line);
        }
      }

      return { ...context, parsed: outputLines.join('\n'), hunks };
    },
  }],
};

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog each showcase project as a single example.
 *
 * - yaml-manifest handles file discovery via meta.yml + include globs
 * - javascript plugin contributes only parsing (frontmatter + custom regions)
 * - bash plugin handles region markers in shell scripts
 * - json-regions plugin handles `"#_region name": true` key markers in .json files
 * - custom region tags (#_region) let standard #region comments stay visible in docs
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin({
      skipExtraction: true,
      regionTag: { start: '#_region', end: '#_endregion' },
    }),
    bashPlugin,
    jsonRegionPlugin,
    createYamlManifestPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
  scan: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: 'examples',
  },
};

export default config;
