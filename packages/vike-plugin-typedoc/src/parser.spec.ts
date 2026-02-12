import { describe, expect, it } from 'vitest';
import { combineApiDocs, parseTypedocJson } from './parser.js';
import { slugify } from './utils.js';

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
        sources: [{ fileName: 'src/types/index.ts', line: 1, character: 0 }],
      },
    ],
  };
}

describe('parseTypedocJson', () => {
  it('parses a function export', () => {
    const json = makeFunctionJson('createMatcher', 'boolean');
    const result = parseTypedocJson(json, 'devkit', '@functional-examples/devkit');

    expect(result.slug).toBe('devkit');
    expect(result.name).toBe('@functional-examples/devkit');
    expect(result.exports).toHaveLength(1);

    const exp = result.exports[0];
    expect(exp.name).toBe('createMatcher');
    expect(exp.slug).toBe('create-matcher');
    expect(exp.kind).toBe('function');
    expect(exp.path).toBe('');
    expect(exp.package).toBe('devkit');
    expect(exp.parameters).toHaveLength(1);
    expect(exp.parameters?.[0].name).toBe('input');
    expect(exp.parameters?.[0].type).toBe('string');
    expect(exp.returnType).toBe('boolean');
    expect(exp.signature).toContain('function createMatcher');
  });

  it('parses an interface export with properties', () => {
    const json = makeInterfaceJson('Config');
    const result = parseTypedocJson(json, 'devkit', '@functional-examples/devkit');

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

  it('assigns exports to modules based on source path', () => {
    const json = {
      ...makeFunctionJson('coreFunc'),
      children: [
        ...(makeFunctionJson('coreFunc').children ?? []),
        {
          id: 10,
          name: 'GlobResult',
          variant: 'declaration',
          kind: 256,
          flags: {},
          comment: { summary: [{ kind: 'text', text: 'Glob result' }] },
          sources: [
            { fileName: 'src/glob/index.ts', line: 1, character: 0 },
          ],
        },
      ],
    };

    const result = parseTypedocJson(json, 'devkit', 'devkit');
    expect(result.modules).toHaveLength(2);

    const moduleNames = result.modules.map((m) => m.name).sort();
    expect(moduleNames).toEqual(['core', 'glob']);
  });

  it('skips private and underscore-prefixed members', () => {
    const json = {
      schemaVersion: '0.0.1',
      id: 0,
      name: 'pkg',
      variant: 'project',
      kind: 1,
      flags: {},
      children: [
        {
          id: 1,
          name: '_internal',
          variant: 'declaration',
          kind: 64,
          flags: {},
          signatures: [
            { id: 2, name: '_internal', variant: 'signature', kind: 4096, flags: {} },
          ],
        },
        {
          id: 3,
          name: 'secret',
          variant: 'declaration',
          kind: 64,
          flags: { isPrivate: true },
          signatures: [
            { id: 4, name: 'secret', variant: 'signature', kind: 4096, flags: {} },
          ],
        },
        {
          id: 5,
          name: 'publicFunc',
          variant: 'declaration',
          kind: 64,
          flags: {},
          signatures: [
            { id: 6, name: 'publicFunc', variant: 'signature', kind: 4096, flags: {} },
          ],
        },
      ],
    };

    const result = parseTypedocJson(json, 'pkg', 'pkg');
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('publicFunc');
  });
});

describe('combineApiDocs', () => {
  it('combines multiple packages into one ApiDocs', () => {
    const pkg1 = parseTypedocJson(
      makeFunctionJson('funcA'),
      'pkg-a',
      'Package A'
    );
    const pkg2 = parseTypedocJson(
      makeInterfaceJson('TypeB'),
      'pkg-b',
      'Package B'
    );

    const docs = combineApiDocs([pkg1, pkg2]);

    expect(Object.keys(docs.packages)).toHaveLength(2);
    expect(docs.packages['pkg-a']).toBe(pkg1);
    expect(docs.packages['pkg-b']).toBe(pkg2);
    expect(docs.allExports).toHaveLength(2);
    // Should be sorted alphabetically (localeCompare: 'funcA' before 'TypeB')
    expect(docs.allExports[0].name).toBe('funcA');
    expect(docs.allExports[1].name).toBe('TypeB');
  });
});

describe('slugify', () => {
  it('converts camelCase to kebab-case', () => {
    expect(slugify('createMatcher')).toBe('create-matcher');
    expect(slugify('parseYaml')).toBe('parse-yaml');
  });

  it('converts PascalCase to kebab-case', () => {
    expect(slugify('ExtractorResult')).toBe('extractor-result');
  });

  it('handles already-kebab strings', () => {
    expect(slugify('already-kebab')).toBe('already-kebab');
  });

  it('strips leading/trailing dashes', () => {
    expect(slugify('-test-')).toBe('test');
  });
});
