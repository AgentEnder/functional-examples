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
 * Inline hash-comment region parser plugin.
 *
 * Handles `# #_region name` / `# #_endregion name` markers in files that use
 * `#` as a comment prefix (.sh, .bash, .yml, .yaml), mirroring the JavaScript
 * parser algorithm.
 */
const hashCommentRegionPlugin: Plugin = {
  name: 'hash-comment-regions',
  extensions: ['.sh', '.bash', '.yml', '.yaml'],
  fileContentsParsers: [
    {
      name: 'bash-parser',
      parse(context: FileParseContext): FileParseContext {
        const startRe = /^[ \t]*#\s*#_region\s+(\S+)\s*$/;
        const endRe = /^[ \t]*#\s*#_endregion(?:\s+(\S+))?\s*$/;

        const lines = context.parsed.split('\n');
        const hunks: ParsedRegion[] = [];
        const outputLines: string[] = [];
        const regionStack: {
          id: string;
          startLine: number;
          lines: string[];
        }[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          const startMatch = line.match(startRe);
          if (startMatch) {
            regionStack.push({
              id: startMatch[1],
              startLine: lineNum,
              lines: [],
            });
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
    },
  ],
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
  fileContentsParsers: [
    {
      name: 'json-region-parser',
      parse(context: FileParseContext): FileParseContext {
        const startRe = /^[ \t]*"#_region\s+(\S+)"\s*:\s*.+$/;
        const endRe = /^[ \t]*"#_endregion\s+(\S+)"\s*:\s*.+$/;

        const lines = context.parsed.split('\n');
        const hunks: ParsedRegion[] = [];
        const outputLines: string[] = [];
        const regionStack: {
          id: string;
          startLine: number;
          lines: string[];
        }[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          const startMatch = line.match(startRe);
          if (startMatch) {
            regionStack.push({
              id: startMatch[1],
              startLine: lineNum,
              lines: [],
            });
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
    },
  ],
};

/**
 * Root configuration for indexing all example projects.
 *
 * This dogfoods the functional-examples package by using it to
 * catalog each showcase project as a single example.
 *
 * - yaml-manifest handles file discovery via meta.yml + include globs
 * - javascript plugin contributes only parsing (frontmatter + custom regions)
 * - hash-comment-regions plugin handles region markers in shell and YAML files
 * - json-regions plugin handles `"#_region name": true` key markers in .json files
 * - custom region tags (#_region) let standard #region comments stay visible in docs
 */
const config: Config = {
  plugins: [
    createJavaScriptPlugin({
      skipExtraction: true,
      regionTag: { start: '#_region', end: '#_endregion' },
    }),
    hashCommentRegionPlugin,
    jsonRegionPlugin,
    createYamlManifestPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
  scan: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: 'examples',
    include: ['*'],
  },
};

export default config;
