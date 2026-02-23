import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as api from './index.js';

function readPackageJson(): Record<string, unknown> {
  const packageJsonPath = new URL('../package.json', import.meta.url);
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('public API', () => {
  it('matches the root value export snapshot', () => {
    expect(Object.keys(api).sort()).toMatchInlineSnapshot(`
      [
        "ExampleFile",
        "PluginRegistry",
        "ScannedExample",
        "createInitialContext",
        "findConfigFile",
        "generateTypes",
        "loadConfig",
        "mergeConfigSchema",
        "mergeConfigs",
        "mergeMetadataSchemas",
        "readExampleFile",
        "readExampleFiles",
        "resolveConfig",
        "runParsePipeline",
        "scan",
        "scanExamples",
        "validateConfig",
        "validateExampleMetadata",
        "validatePluginOptions",
      ]
    `);
  });

  it('keeps a root-only export map', () => {
    const pkg = readPackageJson();
    const exportMap = (pkg.exports ?? {}) as Record<string, unknown>;
    expect(Object.keys(exportMap).sort()).toMatchInlineSnapshot(`
      [
        ".",
      ]
    `);
  });
});
