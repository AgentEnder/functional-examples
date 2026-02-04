import { describe, it, expect } from 'vitest';
import { createSchemaValidator } from './validator.js';

describe('createSchemaValidator', () => {
  it('should validate matching object', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const validate = createSchemaValidator(schema);
    const result = validate({ name: 'test' });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing required field', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        chapter: { type: 'string' },
      },
      required: ['name', 'chapter'],
    };

    const validate = createSchemaValidator(schema);
    const result = validate({ name: 'test' });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe('chapter');
    expect(result.errors[0].message).toContain('required');
  });

  it('should report type mismatch', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    };

    const validate = createSchemaValidator(schema);
    const result = validate({ count: 'not-a-number' });

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.path === 'count')).toBe(true);
  });

  it('should report multiple errors', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['id', 'title'],
    };

    const validate = createSchemaValidator(schema);
    const result = validate({});

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        meta: {
          type: 'object',
          properties: {
            version: { type: 'number' },
          },
          required: ['version'],
        },
      },
      required: ['meta'],
    };

    const validate = createSchemaValidator(schema);

    const valid = validate({ meta: { version: 1 } });
    expect(valid.success).toBe(true);

    const invalid = validate({ meta: {} });
    expect(invalid.success).toBe(false);
    expect(invalid.errors.some((e) => e.path.includes('version'))).toBe(true);
  });

  it('should handle empty schema (allows anything)', () => {
    const schema = {};

    const validate = createSchemaValidator(schema);
    const result = validate({ anything: 'goes' });

    expect(result.success).toBe(true);
  });
});
