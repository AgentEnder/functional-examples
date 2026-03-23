import { describe, expect, it } from 'vitest';
import {
  Deserializer,
  ConsoleLogger,
  FileRegistry,
  LogLevel,
  normalizePath,
} from 'typedoc';
import type { Type } from 'typedoc';
import {
  typeToStringWithRanges,
  remapRanges,
  renderSignatureToHtml,
} from './type-renderer.js';

// ---------------------------------------------------------------------------
// Helper: create Type objects from serialized JSON via TypeDoc's Deserializer
// ---------------------------------------------------------------------------

function createTypeFromJson(
  typeJson: Record<string, unknown>,
  extraChildren: Array<Record<string, unknown>> = []
): Type {
  const logger = new ConsoleLogger();
  logger.level = LogLevel.None;
  const des = new Deserializer(logger);
  const registry = new FileRegistry();

  const project = des.reviveProject(
    'test',
    {
      schemaVersion: '2.0',
      id: 0,
      name: 'test',
      variant: 'project',
      kind: 1,
      flags: {},
      symbolIdMap: {},
      files: { entries: {}, reflections: {} },
      children: [
        ...extraChildren,
        {
          id: 100,
          name: '__target',
          variant: 'declaration',
          kind: 2097152,
          flags: {},
          type: typeJson,
        },
      ],
    } as never,
    { projectRoot: normalizePath('/'), registry }
  );

  const target = project.children?.find((c) => c.name === '__target');
  if (!target?.type) {
    throw new Error('Failed to create type from JSON');
  }
  return target.type;
}

// ---------------------------------------------------------------------------
// typeToStringWithRanges
// ---------------------------------------------------------------------------

describe('typeToStringWithRanges', () => {
  const resolveUrl = (name: string): string | undefined => {
    const urls: Record<string, string> = {
      ScanOptions: '/api/scan-options',
      DigestOutput: '/api/digest-output',
      Config: '/api/config',
    };
    return urls[name];
  };

  it('should render an intrinsic type with no ranges', () => {
    const type = createTypeFromJson({ type: 'intrinsic', name: 'string' });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('string');
    expect(result.ranges).toEqual([]);
  });

  it('should render a simple reference type with a range', () => {
    const type = createTypeFromJson({
      type: 'reference',
      name: 'ScanOptions',
      target: -1,
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('ScanOptions');
    expect(result.ranges).toEqual([
      { start: 0, end: 11, path: '/api/scan-options' },
    ]);
  });

  it('should render a reference type that does not resolve (no range)', () => {
    const type = createTypeFromJson({
      type: 'reference',
      name: 'UnknownType',
      target: -1,
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('UnknownType');
    expect(result.ranges).toEqual([]);
  });

  it('should render a union type with multiple ranges', () => {
    const type = createTypeFromJson({
      type: 'union',
      types: [
        { type: 'reference', name: 'ScanOptions', target: -1 },
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'DigestOutput', target: -1 },
      ],
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('ScanOptions | string | DigestOutput');
    expect(result.ranges).toEqual([
      { start: 0, end: 11, path: '/api/scan-options' },
      { start: 23, end: 35, path: '/api/digest-output' },
    ]);
  });

  it('should render a nested reference type (Promise<Foo>)', () => {
    const type = createTypeFromJson(
      {
        type: 'reference',
        name: 'Promise',
        target: -1,
        typeArguments: [
          { type: 'reference', name: 'DigestOutput', target: -1 },
        ],
      },
    );
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('Promise<DigestOutput>');
    // "Promise" has no URL, so no range for it
    // "DigestOutput" starts at index 8 (after "Promise<")
    expect(result.ranges).toEqual([
      { start: 8, end: 20, path: '/api/digest-output' },
    ]);
  });

  it('should render an intersection type', () => {
    const type = createTypeFromJson({
      type: 'intersection',
      types: [
        { type: 'reference', name: 'ScanOptions', target: -1 },
        { type: 'reference', name: 'Config', target: -1 },
      ],
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('ScanOptions & Config');
    expect(result.ranges).toEqual([
      { start: 0, end: 11, path: '/api/scan-options' },
      { start: 14, end: 20, path: '/api/config' },
    ]);
  });

  it('should render an array type', () => {
    const type = createTypeFromJson({
      type: 'array',
      elementType: { type: 'intrinsic', name: 'string' },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('string[]');
    expect(result.ranges).toEqual([]);
  });

  it('should wrap union in parens when used as array element', () => {
    const type = createTypeFromJson({
      type: 'array',
      elementType: {
        type: 'union',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'intrinsic', name: 'number' },
        ],
      },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('(string | number)[]');
  });

  it('should render a tuple type', () => {
    const type = createTypeFromJson({
      type: 'tuple',
      elements: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'ScanOptions', target: -1 },
      ],
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('[string, ScanOptions]');
    expect(result.ranges).toEqual([
      { start: 9, end: 20, path: '/api/scan-options' },
    ]);
  });

  it('should render a literal string type', () => {
    const type = createTypeFromJson({ type: 'literal', value: 'hello' });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('"hello"');
    expect(result.ranges).toEqual([]);
  });

  it('should render a literal number type', () => {
    const type = createTypeFromJson({ type: 'literal', value: 42 });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('42');
  });

  it('should render a literal boolean type', () => {
    const type = createTypeFromJson({ type: 'literal', value: true });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('true');
  });

  it('should render a conditional type', () => {
    const type = createTypeFromJson({
      type: 'conditional',
      checkType: { type: 'intrinsic', name: 'string' },
      extendsType: { type: 'intrinsic', name: 'number' },
      trueType: { type: 'reference', name: 'ScanOptions', target: -1 },
      falseType: { type: 'intrinsic', name: 'never' },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe(
      'string extends number ? ScanOptions : never'
    );
    expect(result.ranges).toEqual([
      { start: 24, end: 35, path: '/api/scan-options' },
    ]);
  });

  it('should render an indexed access type', () => {
    const type = createTypeFromJson({
      type: 'indexedAccess',
      objectType: { type: 'reference', name: 'ScanOptions', target: -1 },
      indexType: { type: 'intrinsic', name: 'string' },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('ScanOptions[string]');
    expect(result.ranges).toEqual([
      { start: 0, end: 11, path: '/api/scan-options' },
    ]);
  });

  it('should render a type operator (keyof)', () => {
    const type = createTypeFromJson({
      type: 'typeOperator',
      operator: 'keyof',
      target: { type: 'reference', name: 'ScanOptions', target: -1 },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('keyof ScanOptions');
    expect(result.ranges).toEqual([
      { start: 6, end: 17, path: '/api/scan-options' },
    ]);
  });

  it('should render a mapped type', () => {
    const type = createTypeFromJson({
      type: 'mapped',
      parameter: 'K',
      parameterType: { type: 'intrinsic', name: 'string' },
      templateType: { type: 'intrinsic', name: 'number' },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('{ [K in string]: number }');
  });

  it('should render a reflection type (object literal)', () => {
    const type = createTypeFromJson({
      type: 'reflection',
      declaration: {
        id: 50,
        name: '__type',
        variant: 'declaration',
        kind: 65536,
        flags: {},
        children: [
          {
            id: 51,
            name: 'foo',
            variant: 'declaration',
            kind: 1024,
            flags: {},
            type: { type: 'intrinsic', name: 'string' },
          },
          {
            id: 52,
            name: 'bar',
            variant: 'declaration',
            kind: 1024,
            flags: {},
            type: { type: 'intrinsic', name: 'number' },
          },
        ],
      },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('{ foo: string; bar: number }');
  });

  it('should render a reflection type (function signature)', () => {
    const type = createTypeFromJson({
      type: 'reflection',
      declaration: {
        id: 50,
        name: '__type',
        variant: 'declaration',
        kind: 65536,
        flags: {},
        signatures: [
          {
            id: 51,
            name: '__type',
            variant: 'signature',
            kind: 4096,
            flags: {},
            parameters: [
              {
                id: 52,
                name: 'x',
                variant: 'param',
                kind: 32768,
                flags: {},
                type: { type: 'intrinsic', name: 'string' },
              },
            ],
            type: { type: 'intrinsic', name: 'number' },
          },
        ],
      },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('(x: string) => number');
  });

  it('should render a named tuple member', () => {
    const type = createTypeFromJson({
      type: 'namedTupleMember',
      name: 'key',
      isOptional: false,
      element: { type: 'intrinsic', name: 'string' },
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('key: string');
  });

  it('should render a template literal type', () => {
    const type = createTypeFromJson({
      type: 'templateLiteral',
      head: 'prefix-',
      tail: [[{ type: 'intrinsic', name: 'string' }, '-suffix']],
    });
    const result = typeToStringWithRanges(type, resolveUrl);
    expect(result.text).toBe('`prefix-${string}-suffix`');
  });
});

// ---------------------------------------------------------------------------
// remapRanges
// ---------------------------------------------------------------------------

describe('remapRanges', () => {
  it('should remap ranges to new positions in formatted text', () => {
    const original = {
      text: 'ScanOptions|DigestOutput',
      ranges: [
        { start: 0, end: 11, path: '/api/scan-options' },
        { start: 12, end: 24, path: '/api/digest-output' },
      ],
    };
    const formatted = 'ScanOptions | DigestOutput';
    const result = remapRanges(original, formatted);
    expect(result).toEqual([
      { start: 0, end: 11, path: '/api/scan-options' },
      { start: 14, end: 26, path: '/api/digest-output' },
    ]);
  });

  it('should handle case where symbol is not found in formatted text', () => {
    const original = {
      text: 'ScanOptions',
      ranges: [{ start: 0, end: 11, path: '/api/scan-options' }],
    };
    // Simulate a drastic formatting change that loses the symbol
    const formatted = 'completely different text';
    const result = remapRanges(original, formatted);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty ranges', () => {
    const original = { text: 'string', ranges: [] };
    const result = remapRanges(original, 'string');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderSignatureToHtml
// ---------------------------------------------------------------------------

describe('renderSignatureToHtml', () => {
  it('should return HTML with <a> links for symbols in ranges', async () => {
    const text = 'ScanOptions | string';
    const ranges = [{ start: 0, end: 11, path: '/api/scan-options' }];

    const html = await renderSignatureToHtml(text, ranges, {
      format: false,
    });

    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    expect(html).toContain('<a href="/api/scan-options"');
    expect(html).toContain('typedoc-link');
    expect(html).toContain('ScanOptions');
  });

  it('should preserve Shiki syntax highlighting spans', async () => {
    const text = 'string | number';
    const html = await renderSignatureToHtml(text, [], {
      format: false,
    });

    expect(html).toContain('<span');
    expect(html).toContain('style="color:');
  });

  it('should handle empty ranges (no links)', async () => {
    const text = 'string';
    const html = await renderSignatureToHtml(text, [], {
      format: false,
    });

    expect(html).toContain('<pre');
    expect(html).not.toContain('<a ');
    expect(html).toContain('string');
  });

  it('should render multiple ranges correctly', async () => {
    const text = 'Promise<DigestOutput>';
    const ranges = [
      { start: 8, end: 20, path: '/api/digest-output' },
    ];

    const html = await renderSignatureToHtml(text, ranges, {
      format: false,
    });

    expect(html).toContain('<a href="/api/digest-output"');
    expect(html).toContain('DigestOutput');
  });
});
