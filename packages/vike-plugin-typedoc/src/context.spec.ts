import type { RehypeTypedocSymbol } from 'rehype-typedoc';
import { describe, expect, it } from 'vitest';
import { createTypedocContext } from './context.js';
import { parseTypedocJson } from './parser.js';

/** Minimal TypeDoc JSON for a function */
function makeFunctionJson(name: string, returnType = 'void') {
  return {
    schemaVersion: '0.0.1',
    id: 0,
    name: 'test-package',
    variant: 'project',
    kind: 1,
    flags: {},
    children: [
      {
        id: 1,
        name,
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name,
            variant: 'signature',
            kind: 4096,
            flags: {},
            parameters: [
              {
                id: 3,
                name: 'input',
                variant: 'param',
                kind: 32768,
                flags: {},
                type: { type: 'intrinsic', name: 'string' },
              },
            ],
            type: { type: 'intrinsic', name: returnType },
          },
        ],
        sources: [{ fileName: 'src/core/index.ts', line: 1, character: 0 }],
      },
    ],
  };
}

/** Minimal TypeDoc JSON for an interface */
function makeInterfaceJson(name: string) {
  return {
    schemaVersion: '0.0.1',
    id: 0,
    name: 'test-package',
    variant: 'project',
    kind: 1,
    flags: {},
    children: [
      {
        id: 1,
        name,
        variant: 'declaration',
        kind: 256,
        flags: {},
        children: [
          {
            id: 2,
            name: 'value',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            type: { type: 'intrinsic', name: 'string' },
            comment: {
              summary: [{ kind: 'text', text: 'The value property' }],
            },
          },
        ],
        comment: {
          summary: [{ kind: 'text', text: 'A test interface' }],
        },
        sources: [{ fileName: 'src/types/index.ts', line: 1, character: 0 }],
      },
    ],
  };
}

function makeTestPackages() {
  const pkg1 = parseTypedocJson(
    makeFunctionJson('createMatcher', 'boolean'),
    'devkit',
    '@functional-examples/devkit'
  );
  const pkg2 = parseTypedocJson(
    makeInterfaceJson('Config'),
    'core',
    '@functional-examples/core'
  );
  return [pkg1, pkg2];
}

describe('createTypedocContext', () => {
  it('returns correct structure', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    expect(ctx.apiDocs).toBeDefined();
    expect(ctx.symbolsMap).toBeInstanceOf(Map);
    expect(ctx.navigation).toBeInstanceOf(Array);
    expect(ctx.rehypeOptions).toBeDefined();
    expect(ctx.rehypeOptions.symbols).toBe(ctx.symbolsMap);
    expect(typeof ctx.rehypeOptions.buildLink).toBe('function');
    expect(typeof ctx.getLinkedExport).toBe('function');
    expect(typeof ctx.getPackage).toBe('function');
    expect(typeof ctx.getExportUrls).toBe('function');
  });

  it('applies default buildUrl to export paths', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    const exp = ctx.apiDocs.packages['devkit'].exports[0];
    expect(exp.path).toBe('/api/devkit/create-matcher');
  });

  it('applies custom buildUrl to export paths', async () => {
    const ctx = await createTypedocContext(makeTestPackages(), {
      buildUrl: (pkg, sym) =>
        sym ? `/docs/api/${pkg}/${sym}` : `/docs/api/${pkg}`,
    });

    const exp = ctx.apiDocs.packages['devkit'].exports[0];
    expect(exp.path).toBe('/docs/api/devkit/create-matcher');
  });

  it('getPackage returns package by slug', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    const pkg = ctx.getPackage('devkit');
    expect(pkg).not.toBeNull();
    expect(pkg?.name).toBe('@functional-examples/devkit');
  });

  it('getPackage returns null for unknown slug', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    expect(ctx.getPackage('nonexistent')).toBeNull();
  });

  it('getLinkedExport returns linked data with type HTML', async () => {
    // Create a function whose parameter type references an interface
    const pkgs = makeTestPackages();
    const ctx = await createTypedocContext(pkgs);

    const linked = ctx.getLinkedExport('devkit', 'create-matcher');
    expect(linked).not.toBeNull();
    expect(linked?.name).toBe('createMatcher');
    expect(linked?.parameters).toBeDefined();
    // The parameter type is 'string' — an intrinsic, so typeHtml equals 'string'
    expect(linked?.parameters?.[0].typeHtml).toBe('string');
  });

  it('getLinkedExport returns null for missing package', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    expect(ctx.getLinkedExport('nonexistent', 'foo')).toBeNull();
  });

  it('getLinkedExport returns null for missing symbol', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    expect(ctx.getLinkedExport('devkit', 'nonexistent')).toBeNull();
  });

  it('getExportUrls returns all paths', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    const urls = ctx.getExportUrls();

    expect(urls).toContain('/api/devkit/create-matcher');
    expect(urls).toContain('/api/core/config');
    expect(urls).toHaveLength(2);
  });

  it('getPackageUrls returns all package paths', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    const urls = ctx.getPackageUrls();

    expect(urls).toContain('/api/devkit');
    expect(urls).toContain('/api/core');
    expect(urls).toHaveLength(2);
  });

  it('getAllPrerenderUrls returns both package and export URLs', async () => {
    const ctx = await createTypedocContext(makeTestPackages());
    const urls = ctx.getAllPrerenderUrls();

    // Package URLs
    expect(urls).toContain('/api/devkit');
    expect(urls).toContain('/api/core');
    // Export URLs
    expect(urls).toContain('/api/devkit/create-matcher');
    expect(urls).toContain('/api/core/config');
    expect(urls).toHaveLength(4);
  });

  it('getPackageUrls respects custom buildUrl', async () => {
    const ctx = await createTypedocContext(makeTestPackages(), {
      buildUrl: (pkg, sym) => (sym ? `/docs/${pkg}/${sym}` : `/docs/${pkg}`),
    });
    const urls = ctx.getPackageUrls();

    expect(urls).toContain('/docs/devkit');
    expect(urls).toContain('/docs/core');
  });

  it('navigation contains package entries', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    expect(ctx.navigation.length).toBe(2);
    const names = ctx.navigation.map((n) => n.title);
    expect(names).toContain('@functional-examples/core');
    expect(names).toContain('@functional-examples/devkit');
  });

  it('rehypeOptions.buildLink resolves symbol paths', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    const symbol = ctx.symbolsMap.get('createMatcher');
    expect(symbol).toBeDefined();

    // buildLink should return the path from the symbol
    const resolved = (Array.isArray(symbol) ? symbol[0] : symbol) as RehypeTypedocSymbol;
    const link = ctx.rehypeOptions.buildLink(resolved);
    expect(link).toBe('/api/devkit/create-matcher');
  });

  it('getLinkedExport includes pre-rendered descriptionHtml', async () => {
    const ctx = await createTypedocContext(makeTestPackages());

    // Config interface has a comment.summary = "A test interface"
    const linked = ctx.getLinkedExport('core', 'config');
    expect(linked).not.toBeNull();
    expect(linked?.descriptionHtml).toBeDefined();
    expect(linked?.descriptionHtml).toContain('A test interface');
  });

  describe('single-package auto-detection', () => {
    function makeSinglePackage() {
      return [
        parseTypedocJson(
          makeFunctionJson('createWorker', 'Worker'),
          'api',
          'isolated-workers'
        ),
      ];
    }

    it('omits package slug from export paths for single package', async () => {
      const ctx = await createTypedocContext(makeSinglePackage());
      const exp = ctx.apiDocs.packages['api'].exports[0];
      expect(exp.path).toBe('/api/create-worker');
    });

    it('produces basePath as the package URL for single package', async () => {
      const ctx = await createTypedocContext(makeSinglePackage());
      const urls = ctx.getPackageUrls();
      expect(urls).toEqual(['/api']);
    });

    it('flattens navigation for single package', async () => {
      const ctx = await createTypedocContext(makeSinglePackage());
      // Should be flat: no children, just export items at top level
      expect(ctx.navigation.every((n) => !n.children?.length)).toBe(true);
      expect(ctx.navigation.some((n) => n.title === 'createWorker')).toBe(true);
    });

    it('custom buildUrl still overrides single-package default', async () => {
      const ctx = await createTypedocContext(makeSinglePackage(), {
        buildUrl: (pkg, sym) => (sym ? `/docs/${pkg}/${sym}` : `/docs/${pkg}`),
      });
      const exp = ctx.apiDocs.packages['api'].exports[0];
      expect(exp.path).toBe('/docs/api/create-worker');
    });

    it('multi-package still uses package slug in URLs', async () => {
      const ctx = await createTypedocContext(makeTestPackages());
      const exp = ctx.apiDocs.packages['devkit'].exports[0];
      expect(exp.path).toBe('/api/devkit/create-matcher');
    });
  });

  describe('baseUrl option', () => {
    it('applyBaseUrl prepends base to route-relative paths', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/functional-examples/',
      });

      expect(ctx.applyBaseUrl('/api/devkit')).toBe(
        '/functional-examples/api/devkit'
      );
      expect(ctx.applyBaseUrl('/api/devkit/create-matcher')).toBe(
        '/functional-examples/api/devkit/create-matcher'
      );
    });

    it('applyBaseUrl is a no-op when baseUrl is /', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/',
      });

      expect(ctx.applyBaseUrl('/api/devkit')).toBe('/api/devkit');
    });

    it('applyBaseUrl is a no-op when baseUrl is omitted', async () => {
      const ctx = await createTypedocContext(makeTestPackages());

      expect(ctx.applyBaseUrl('/api/devkit')).toBe('/api/devkit');
    });

    it('exp.path remains route-relative even when baseUrl is set', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/functional-examples/',
      });

      const exp = ctx.apiDocs.packages['devkit'].exports[0];
      expect(exp.path).toBe('/api/devkit/create-matcher');
    });

    it('rehypeOptions.buildLink returns base-prefixed URL when baseUrl is set', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/functional-examples/',
      });

      const symbol = ctx.symbolsMap.get('createMatcher');
      expect(symbol).toBeDefined();

      const resolved = (Array.isArray(symbol) ? symbol[0] : symbol) as RehypeTypedocSymbol;
      const link = ctx.rehypeOptions.buildLink(resolved);
      expect(link).toBe('/functional-examples/api/devkit/create-matcher');
    });

    it('prerender URLs remain route-relative when baseUrl is set', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/functional-examples/',
      });

      const urls = ctx.getAllPrerenderUrls();
      // All URLs should be route-relative (no base prefix)
      expect(urls).toContain('/api/devkit');
      expect(urls).toContain('/api/devkit/create-matcher');
      expect(urls.every((u) => !u.startsWith('/functional-examples/'))).toBe(
        true
      );
    });

    it('exposes baseUrl on context', async () => {
      const ctx = await createTypedocContext(makeTestPackages(), {
        baseUrl: '/functional-examples/',
      });
      expect(ctx.baseUrl).toBe('/functional-examples/');
    });

    it('defaults baseUrl to / when not provided', async () => {
      const ctx = await createTypedocContext(makeTestPackages());
      expect(ctx.baseUrl).toBe('/');
    });
  });
});
