import { describe, expect, it } from 'vitest';
import {
  combineApiDocs,
  deserializeTypedocJson,
} from './deserialize.js';
import type { ApiExportWithTypeRef } from './deserialize.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Base project envelope — every fixture wraps children in this. */
function makeProject(
  children: Record<string, unknown>[]
): Record<string, unknown> {
  return {
    schemaVersion: '2.0',
    id: 0,
    name: 'test-package',
    variant: 'project',
    kind: 1,
    flags: {},
    children,
    files: { entries: {}, reflections: {} },
  };
}

/** Minimal TypeDoc JSON for a function with one string parameter. */
function makeFunctionJson(
  name: string,
  returnType = 'void',
  sourceFile = 'src/core/index.ts'
) {
  return makeProject([
    {
      id: 1,
      name,
      variant: 'declaration',
      kind: 64, // Function
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
      sources: [{ fileName: sourceFile, line: 1, character: 0 }],
    },
  ]);
}

/** Minimal TypeDoc JSON for an interface with one property. */
function makeInterfaceJson(name: string) {
  return makeProject([
    {
      id: 1,
      name,
      variant: 'declaration',
      kind: 256, // Interface
      flags: {},
      children: [
        {
          id: 2,
          name: 'value',
          variant: 'declaration',
          kind: 1024, // Property
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
      sources: [
        { fileName: 'src/types/index.ts', line: 1, character: 0 },
      ],
    },
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deserializeTypedocJson', () => {
  it('parses a function export', () => {
    const json = makeFunctionJson('createMatcher', 'boolean');
    const result = deserializeTypedocJson(
      json,
      'devkit',
      '@functional-examples/devkit'
    );

    expect(result.slug).toBe('devkit');
    expect(result.name).toBe('@functional-examples/devkit');
    expect(result.exports).toHaveLength(1);

    const exp = result.exports[0];
    expect(exp.name).toBe('createMatcher');
    expect(exp.slug).toBe('create-matcher');
    expect(exp.kind).toBe('function');
    expect(exp.package).toBe('devkit');
    expect(exp.parameters).toHaveLength(1);
    expect(exp.parameters?.[0].name).toBe('input');
    expect(exp.parameters?.[0].type).toBe('string');
    expect(exp.returnType).toBe('boolean');
    expect(exp.signature).toContain('function createMatcher');
    expect(exp.signature).toContain('input: string');
    expect(exp.signature).toContain('boolean');
  });

  it('parses an interface export with properties', () => {
    const json = makeInterfaceJson('Config');
    const result = deserializeTypedocJson(
      json,
      'devkit',
      '@functional-examples/devkit'
    );

    expect(result.exports).toHaveLength(1);

    const exp = result.exports[0];
    expect(exp.name).toBe('Config');
    expect(exp.kind).toBe('interface');
    expect(exp.description).toBe('A test interface');
    expect(exp.properties).toHaveLength(1);
    expect(exp.properties?.[0].name).toBe('value');
    expect(exp.properties?.[0].optional).toBe(true);
    expect(exp.properties?.[0].description).toBe('The value property');
    expect(exp.signature).toContain('interface Config');
  });

  it('parses a type alias', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'MyType',
        variant: 'declaration',
        kind: 2097152, // TypeAlias
        flags: {},
        type: {
          type: 'union',
          types: [
            { type: 'intrinsic', name: 'string' },
            { type: 'intrinsic', name: 'number' },
          ],
        },
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(1);

    const exp = result.exports[0];
    expect(exp.name).toBe('MyType');
    expect(exp.kind).toBe('type');
    expect(exp.signature).toBe('type MyType = string | number');
  });

  it('stores raw Type object on _typeRef for functions', () => {
    const json = makeFunctionJson('myFunc', 'boolean');
    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0] as ApiExportWithTypeRef;
    expect(exp._typeRef).toBeDefined();
    expect(exp._typeRef?.toString()).toBe('boolean');
  });

  it('stores raw Type object on _typeRef for type aliases', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'MyType',
        variant: 'declaration',
        kind: 2097152,
        flags: {},
        type: { type: 'intrinsic', name: 'string' },
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0] as ApiExportWithTypeRef;
    expect(exp._typeRef).toBeDefined();
    expect(exp._typeRef?.toString()).toBe('string');
  });

  it('detects re-exports from another package', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'reExported',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: 'reExported',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
        sources: [
          {
            fileName: 'devkit/dist/types/index.d.ts',
            line: 1,
            character: 0,
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'my-pkg', 'my-pkg');
    expect(result.exports[0].isReExport).toBe(true);
  });

  it('does not mark own-package exports as re-exports', () => {
    const json = makeFunctionJson('ownFunc', 'void', 'packages/devkit/src/core.ts');
    const result = deserializeTypedocJson(json, 'devkit', 'devkit');
    expect(result.exports[0].isReExport).toBeUndefined();
  });

  it('skips private reflections', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'secret',
        variant: 'declaration',
        kind: 64,
        flags: { isPrivate: true },
        signatures: [
          {
            id: 2,
            name: 'secret',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
      },
      {
        id: 3,
        name: 'publicFunc',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 4,
            name: 'publicFunc',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('publicFunc');
  });

  it('skips protected reflections', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'protectedFunc',
        variant: 'declaration',
        kind: 64,
        flags: { isProtected: true },
        signatures: [
          {
            id: 2,
            name: 'protectedFunc',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(0);
  });

  it('skips underscore-prefixed reflections', () => {
    const json = makeProject([
      {
        id: 1,
        name: '_internal',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: '_internal',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(0);
  });

  it('parses comment summary, remarks, examples, and deprecated', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'documented',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: 'documented',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
            comment: {
              summary: [{ kind: 'text', text: 'Does something useful' }],
              blockTags: [
                {
                  tag: '@remarks',
                  content: [{ kind: 'text', text: 'Additional details' }],
                },
                {
                  tag: '@example',
                  content: [
                    {
                      kind: 'code',
                      text: '```ts\ndocumented()\n```',
                    },
                  ],
                },
                {
                  tag: '@deprecated',
                  content: [{ kind: 'text', text: 'Use newFunc instead' }],
                },
                {
                  tag: '@see',
                  content: [{ kind: 'text', text: 'newFunc' }],
                },
              ],
            },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0];

    expect(exp.description).toBe('Does something useful');
    expect(exp.comment?.summary).toBe('Does something useful');
    expect(exp.comment?.remarks).toBe('Additional details');
    expect(exp.comment?.examples).toEqual(['documented()']);
    expect(exp.comment?.deprecated).toBe('Use newFunc instead');
    expect(exp.comment?.see).toEqual(['newFunc']);
  });

  it('assigns exports to modules based on source path', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'coreFunc',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: 'coreFunc',
            variant: 'signature',
            kind: 4096,
            flags: {},
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
        sources: [
          { fileName: 'src/core/index.ts', line: 1, character: 0 },
        ],
      },
      {
        id: 10,
        name: 'GlobResult',
        variant: 'declaration',
        kind: 256, // Interface
        flags: {},
        sources: [
          { fileName: 'src/glob/index.ts', line: 1, character: 0 },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'devkit', 'devkit');
    expect(result.modules).toHaveLength(2);

    const moduleNames = result.modules.map((m) => m.name).sort();
    expect(moduleNames).toEqual(['core', 'glob']);
  });

  it('defaults to core module when no source path', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'noSource',
        variant: 'declaration',
        kind: 32, // Variable
        flags: {},
        type: { type: 'intrinsic', name: 'string' },
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].name).toBe('core');
  });

  it('recurses into Module-kind children', () => {
    const json = makeProject([
      {
        id: 5,
        name: 'glob-module',
        variant: 'declaration',
        kind: 2, // Module
        flags: {},
        children: [
          {
            id: 6,
            name: 'globFunc',
            variant: 'declaration',
            kind: 64,
            flags: {},
            signatures: [
              {
                id: 7,
                name: 'globFunc',
                variant: 'signature',
                kind: 4096,
                flags: {},
                type: { type: 'intrinsic', name: 'void' },
              },
            ],
            sources: [
              { fileName: 'src/glob/index.ts', line: 1, character: 0 },
            ],
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('globFunc');
    expect(result.modules[0].name).toBe('glob');
  });

  it('parses interface methods', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'MyService',
        variant: 'declaration',
        kind: 256,
        flags: {},
        children: [
          {
            id: 2,
            name: 'execute',
            variant: 'declaration',
            kind: 2048, // Method
            flags: {},
            signatures: [
              {
                id: 3,
                name: 'execute',
                variant: 'signature',
                kind: 4096,
                flags: {},
                parameters: [
                  {
                    id: 4,
                    name: 'cmd',
                    variant: 'param',
                    kind: 32768,
                    flags: {},
                    type: { type: 'intrinsic', name: 'string' },
                  },
                ],
                type: { type: 'intrinsic', name: 'void' },
                comment: {
                  summary: [{ kind: 'text', text: 'Execute a command' }],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0];
    expect(exp.methods).toHaveLength(1);
    expect(exp.methods?.[0].name).toBe('execute');
    expect(exp.methods?.[0].signature).toBe('execute(cmd: string): void');
    expect(exp.methods?.[0].description).toBe('Execute a command');
    expect(exp.methods?.[0].returnType).toBe('void');
  });

  it('parses function with type parameters', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'transform',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: 'transform',
            variant: 'signature',
            kind: 4096,
            flags: {},
            typeParameters: [
              {
                id: 10,
                name: 'T',
                variant: 'typeParam',
                kind: 131072,
                flags: {},
                type: { type: 'intrinsic', name: 'object' },
              },
            ],
            parameters: [
              {
                id: 3,
                name: 'val',
                variant: 'param',
                kind: 32768,
                flags: {},
                type: { type: 'reference', name: 'T', target: 10 },
              },
            ],
            type: { type: 'reference', name: 'T', target: 10 },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0];
    expect(exp.typeParameters).toHaveLength(1);
    expect(exp.typeParameters?.[0].name).toBe('T');
    expect(exp.typeParameters?.[0].constraint).toBe('object');
    expect(exp.signature).toContain('<T>');
  });

  it('parses interface with extends', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'Child',
        variant: 'declaration',
        kind: 256,
        flags: {},
        extendedTypes: [
          { type: 'reference', name: 'Parent', target: -1 },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0];
    expect(exp.signature).toBe('interface Child extends Parent');
  });

  it('disambiguates colliding slugs', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'config',
        variant: 'declaration',
        kind: 32, // Variable
        flags: {},
        type: { type: 'intrinsic', name: 'object' },
      },
      {
        id: 2,
        name: 'Config',
        variant: 'declaration',
        kind: 256, // Interface
        flags: {},
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(2);
    const slugs = result.exports.map((e) => e.slug).sort();
    expect(slugs).toEqual(['config-interface', 'config-variable']);
  });

  it('filters empty reflection members from intersection types', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'MyType',
        variant: 'declaration',
        kind: 2097152, // TypeAlias
        flags: {},
        type: {
          type: 'intersection',
          types: [
            {
              type: 'reflection',
              declaration: {
                id: 2,
                name: '__type',
                variant: 'declaration',
                kind: 65536,
                flags: {},
                children: [
                  {
                    id: 3,
                    name: 'dir',
                    variant: 'declaration',
                    kind: 1024,
                    flags: { isOptional: true },
                    type: { type: 'intrinsic', name: 'string' },
                  },
                ],
              },
            },
            {
              type: 'reflection',
              declaration: {
                id: 4,
                name: '__type',
                variant: 'declaration',
                kind: 65536,
                flags: {},
                // empty — no children, no signatures
              },
            },
            {
              type: 'reflection',
              declaration: {
                id: 5,
                name: '__type',
                variant: 'declaration',
                kind: 65536,
                flags: {},
                children: [
                  {
                    id: 6,
                    name: 'plugins',
                    variant: 'declaration',
                    kind: 1024,
                    flags: { isOptional: true },
                    type: {
                      type: 'array',
                      elementType: { type: 'intrinsic', name: 'string' },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const exp = result.exports[0];
    // The empty reflection should be filtered out, no "& {}" in the signature
    expect(exp.signature).not.toContain('{}');
    expect(exp.signature).toContain('dir');
    expect(exp.signature).toContain('plugins');
  });

  it('handles empty project gracefully', () => {
    const json = makeProject([]);
    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(0);
    expect(result.modules).toHaveLength(0);
  });

  it('parses optional parameters with defaults', () => {
    const json = makeProject([
      {
        id: 1,
        name: 'greet',
        variant: 'declaration',
        kind: 64,
        flags: {},
        signatures: [
          {
            id: 2,
            name: 'greet',
            variant: 'signature',
            kind: 4096,
            flags: {},
            parameters: [
              {
                id: 3,
                name: 'name',
                variant: 'param',
                kind: 32768,
                flags: { isOptional: true },
                type: { type: 'intrinsic', name: 'string' },
                defaultValue: '"World"',
              },
            ],
            type: { type: 'intrinsic', name: 'string' },
          },
        ],
      },
    ]);

    const result = deserializeTypedocJson(json, 'pkg', 'pkg');
    const param = result.exports[0].parameters?.[0];
    expect(param?.optional).toBe(true);
    expect(param?.defaultValue).toBe('"World"');
    expect(result.exports[0].signature).toContain('name?');
  });
});

describe('combineApiDocs', () => {
  it('combines multiple packages into one ApiDocs', () => {
    const pkg1 = deserializeTypedocJson(
      makeFunctionJson('funcA'),
      'pkg-a',
      'Package A'
    );
    const pkg2 = deserializeTypedocJson(
      makeInterfaceJson('TypeB'),
      'pkg-b',
      'Package B'
    );

    const docs = combineApiDocs([pkg1, pkg2]);

    expect(Object.keys(docs.packages)).toHaveLength(2);
    expect(docs.packages['pkg-a']).toBe(pkg1);
    expect(docs.packages['pkg-b']).toBe(pkg2);
    expect(docs.allExports).toHaveLength(2);
    expect(docs.allExports[0].name).toBe('funcA');
    expect(docs.allExports[1].name).toBe('TypeB');
  });
});
