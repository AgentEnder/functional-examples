import { PageContextServer } from 'vike/types';
import { describe, expect, it } from 'vitest';
import { createTypedocContext } from './context.js';
import type { TypedocContext } from './context.js';
import { deserializeTypedocJson } from './deserialize.js';
import { getTypedocContext, withApiExport, withApiPackage } from './server.js';

/** Minimal TypeDoc JSON for a function (schema v2.0) */
function makeFunctionJson(name: string, returnType = 'void') {
  return {
    schemaVersion: '2.0',
    id: 0,
    name: 'test-package',
    variant: 'project',
    kind: 1,
    flags: {},
    files: { entries: {}, reflections: {} },
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
        sources: [{ fileName: 'src/core/index.ts', line: 1, character: 0, url: '' }],
      },
    ],
  };
}

async function makeTestContext() {
  const pkg = deserializeTypedocJson(
    makeFunctionJson('createMatcher', 'boolean'),
    'devkit',
    '@functional-examples/devkit'
  );
  return await createTypedocContext([pkg]);
}

function makePageContext(typedocContext: TypedocContext) {
  return {
    globalContext: {
      $$VIKE_PLUGIN_TYPEDOC$$: typedocContext,
    },
  } as unknown as PageContextServer;
}

describe('getTypedocContext', () => {
  it('returns TypedocContext from global context', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const ctx = getTypedocContext(pageContext);
    expect(ctx.apiDocs).toBeDefined();
    expect(ctx.navigation).toBeInstanceOf(Array);
  });

  it('throws when TypedocContext is missing', () => {
    const pageContext = { globalContext: {} } as unknown as PageContextServer;
    expect(() => getTypedocContext(pageContext)).toThrow(
      'TypedocContext not found on global context'
    );
  });
});

describe('withApiPackage', () => {
  it('returns data with plugin key for existing package', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const result = withApiPackage(pageContext, 'devkit');

    expect(result).toHaveProperty('$$VIKE_PLUGIN_TYPEDOC$$');
    const data = result['$$VIKE_PLUGIN_TYPEDOC$$'] as Record<string, unknown>;
    expect(data.packageSlug).toBe('devkit');
    expect(data.packageName).toBe('@functional-examples/devkit');
    expect(data.apiPackage).not.toBeNull();
  });

  it('returns null apiPackage for unknown package', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const result = withApiPackage(pageContext, 'nonexistent');

    const data = result['$$VIKE_PLUGIN_TYPEDOC$$'] as Record<string, unknown>;
    expect(data.apiPackage).toBeNull();
    expect(data.packageSlug).toBe('nonexistent');
    expect(data.packageName).toBe('nonexistent');
  });
});

describe('withApiExport', () => {
  it('returns data with plugin key for existing export', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const result = withApiExport(pageContext, 'devkit', 'create-matcher');

    expect(result).toHaveProperty('$$VIKE_PLUGIN_TYPEDOC$$');
    const data = result['$$VIKE_PLUGIN_TYPEDOC$$'] as Record<string, unknown>;
    expect(data.packageSlug).toBe('devkit');
    expect(data.packageName).toBe('@functional-examples/devkit');
    expect(data.apiExport).not.toBeNull();
    expect(data.apiPackage).not.toBeNull();
  });

  it('returns null apiExport for unknown symbol', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const result = withApiExport(pageContext, 'devkit', 'nonexistent');

    const data = result['$$VIKE_PLUGIN_TYPEDOC$$'] as Record<string, unknown>;
    expect(data.apiExport).toBeNull();
    expect(data.apiPackage).not.toBeNull();
  });

  it('returns null apiExport and apiPackage for unknown package', async () => {
    const typedocCtx = await makeTestContext();
    const pageContext = makePageContext(typedocCtx);
    const result = withApiExport(pageContext, 'nonexistent', 'foo');

    const data = result['$$VIKE_PLUGIN_TYPEDOC$$'] as Record<string, unknown>;
    expect(data.apiExport).toBeNull();
    expect(data.apiPackage).toBeNull();
  });
});
