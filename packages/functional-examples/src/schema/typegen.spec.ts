import { describe, it, expect } from 'vitest';
import { generateMetadataTypes } from './typegen.js';

describe('generateMetadataTypes', () => {
  it('should generate interface from merged schema', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        category: { type: 'string', enum: ['tutorial', 'recipe'] },
      },
      required: ['id', 'title'],
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('export interface ExampleMetadata');
    expect(result).toContain('id: string');
    expect(result).toContain('title: string');
    expect(result).toContain('category?: "tutorial" | "recipe"');
  });

  it('should mark required fields without optional modifier', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        required: { type: 'string' },
        optional: { type: 'string' },
      },
      required: ['required'],
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('required: string');
    expect(result).toContain('optional?: string');
  });

  it('should generate valid TypeScript for various types', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        str: { type: 'string' },
        num: { type: 'number' },
        bool: { type: 'boolean' },
        arr: { type: 'array', items: { type: 'string' } },
        constVal: { const: 'fixed' },
      },
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('str?: string');
    expect(result).toContain('num?: number');
    expect(result).toContain('bool?: boolean');
    expect(result).toContain('arr?: Array<string>');
    expect(result).toContain('constVal?: "fixed"');
  });

  it('should return Record<string, unknown> when no schema provided', () => {
    const result = generateMetadataTypes({});

    expect(result).toContain(
      'export type ExampleMetadata = Record<string, unknown>'
    );
  });

  it('should handle empty properties object', () => {
    const result = generateMetadataTypes({
      mergedSchema: { type: 'object', properties: {} },
    });

    expect(result).toContain('export interface ExampleMetadata');
  });

  it('should include auto-generated header', () => {
    const result = generateMetadataTypes({
      mergedSchema: { type: 'object', properties: { id: { type: 'string' } } },
    });

    expect(result).toContain('Auto-generated metadata types');
    expect(result).toContain('Do not edit manually');
  });

  it('should handle integer type as number', () => {
    const result = generateMetadataTypes({
      mergedSchema: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
        },
      },
    });

    expect(result).toContain('count?: number');
  });

  it('should handle null type', () => {
    const result = generateMetadataTypes({
      mergedSchema: {
        type: 'object',
        properties: {
          empty: { type: 'null' },
        },
      },
    });

    expect(result).toContain('empty?: null');
  });

  it('should handle array without items as unknown[]', () => {
    const result = generateMetadataTypes({
      mergedSchema: {
        type: 'object',
        properties: {
          items: { type: 'array' },
        },
      },
    });

    expect(result).toContain('items?: unknown[]');
  });

  it('should handle nested objects', () => {
    const result = generateMetadataTypes({
      mergedSchema: {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              inner: { type: 'string' },
            },
            required: ['inner'],
          },
        },
      },
    });

    expect(result).toContain('nested?:');
    expect(result).toContain('inner: string');
  });
});
