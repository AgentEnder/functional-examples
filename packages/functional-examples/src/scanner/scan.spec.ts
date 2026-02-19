import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginRegistry } from '../plugins/registry.js';
import type {
  Extractor,
  Plugin,
  ResolvedConfig,
} from '../types/index.js';
import { scan } from './scan.js';

/** Create a temp dir with a config file so `findConfigFile` discovers it. */
async function createTempProject(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-test-'));
  // Minimal JSON config
  await fs.writeFile(
    path.join(tmpDir, 'functional-examples.config.json'),
    JSON.stringify({ root: '.' }),
    'utf-8'
  );
  return tmpDir;
}

describe('scan()', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempProject();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should throw when no config file is found', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-empty-'));
    try {
      await expect(scan({ root: emptyDir })).rejects.toThrow(
        'No functional-examples config found'
      );
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });

  it('should use pre-built config when provided', async () => {
    const mockExtractor: Extractor = {
      name: 'mock',
      extract: async () => ({
        examples: [
          {
            id: 'mock-example',
            title: 'Mock',
            rootPath: tmpDir,
            files: [],
            metadata: {},
            extractorName: 'mock',
          },
        ],
        errors: [],
        claimedFiles: new Set<string>(),
      }),
    };

    const mockPlugin: Plugin = {
      name: 'mock-plugin',
      extractor: mockExtractor,
    };

    const registry = new PluginRegistry();
    registry.register(mockPlugin);

    const config: ResolvedConfig = {
      root: tmpDir,
      plugins: [mockPlugin],
      extractors: [mockExtractor],
      registry,
      pathMappings: [],
      scan: { include: ['*'], exclude: [], root: tmpDir },
      validationErrors: [],
      region: {
        startTag: 'region',
        endTag: 'endregion',
        fileExtensionMap: {},
      },
    };

    const result = await scan({ config });

    expect(result.examples).toHaveLength(1);
    expect(result.examples[0].id).toBe('mock-example');
  });

  it('should discover config from root directory', async () => {
    // Config is discovered and plugins are auto-detected from installed packages.
    // Empty temp dir means no examples found, but scan succeeds without errors.
    const result = await scan({ root: tmpDir });

    expect(result).toBeDefined();
    expect(result.examples).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it('should error when no extractors are available', async () => {
    // When a resolved config has no plugins/extractors (e.g. none could be
    // auto-detected), the scanner should report a "No extractors provided" error
    // so the user knows nothing can be found.
    const registry = new PluginRegistry();
    const config: ResolvedConfig = {
      root: tmpDir,
      plugins: [],
      extractors: [],
      registry,
      pathMappings: [],
      scan: { include: ['*'], exclude: [], root: tmpDir },
      validationErrors: [],
      region: {
        startTag: 'region',
        endTag: 'endregion',
        fileExtensionMap: {},
      },
    };

    const result = await scan({ config });

    expect(result.examples).toHaveLength(0);
    expect(
      result.errors.some((e) => e.message.includes('No extractors'))
    ).toBe(true);
  });
});
