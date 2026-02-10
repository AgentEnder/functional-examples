import { describe, it, expect } from 'vitest';

import { parseJson, tryParseJson, JsonParseError } from './parse.js';

describe('parseJson', () => {
  it('should parse valid JSON', async () => {
    const result = await parseJson<{ name: string }>(
      '{"name": "hello"}'
    );
    expect(result).toEqual({ name: 'hello' });
  });

  it('should parse JSON arrays', async () => {
    const result = await parseJson<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('should parse JSON primitives', async () => {
    expect(await parseJson('"hello"')).toBe('hello');
    expect(await parseJson('42')).toBe(42);
    expect(await parseJson('true')).toBe(true);
    expect(await parseJson('null')).toBeNull();
  });

  it('should parse JSON with comments via jsonc-parser', async () => {
    const content = `{
      // This is a comment
      "name": "test",
      /* block comment */
      "value": 42
    }`;
    const result = await parseJson<{ name: string; value: number }>(content);
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('should parse JSON with trailing commas', async () => {
    const content = `{
      "name": "test",
      "items": [1, 2, 3,],
    }`;
    const result = await parseJson<{ name: string; items: number[] }>(content);
    expect(result).toEqual({ name: 'test', items: [1, 2, 3] });
  });

  it('should throw JsonParseError for invalid JSON', async () => {
    await expect(parseJson('{bad json}')).rejects.toThrow(JsonParseError);
  });

  it('should include line/column info in JsonParseError', async () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n}';
    try {
      await parseJson(content);
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JsonParseError);
      const err = e as JsonParseError;
      // The error should have some position info
      expect(err.line).toBeDefined();
    }
  });

  it('should include code frame in error message', async () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n}';
    try {
      await parseJson(content);
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JsonParseError);
      const err = e as JsonParseError;
      // The formatted message should contain surrounding code
      expect(err.message).toContain('"bad"');
    }
  });

  it('should include filePath in error when provided', async () => {
    const content = '{ invalid }';
    try {
      await parseJson(content, 'my-config.json');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JsonParseError);
      const err = e as JsonParseError;
      expect(err.filePath).toBe('my-config.json');
      expect(err.message).toContain('my-config.json');
    }
  });
});

describe('tryParseJson', () => {
  it('should return success result for valid JSON', async () => {
    const result = await tryParseJson<{ name: string }>('{"name": "ok"}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'ok' });
    }
  });

  it('should return success for JSON with comments', async () => {
    const content = `{
      // comment
      "key": "value"
    }`;
    const result = await tryParseJson<{ key: string }>(content);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' });
    }
  });

  it('should return error result for invalid JSON', async () => {
    const result = await tryParseJson('{ not valid }');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(JsonParseError);
      expect(result.error.message).toContain('Failed to parse JSON');
    }
  });

  it('should include filePath in error result when provided', async () => {
    const result = await tryParseJson('bad', 'test.json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.filePath).toBe('test.json');
    }
  });
});
