import { describe, expect, it } from 'vitest';
import { parseYaml, tryParseYaml, YamlParseError } from './parse.js';

describe('parseYaml', () => {
  it('should parse a simple YAML object', async () => {
    const result = await parseYaml<{ name: string }>('name: hello');
    expect(result).toEqual({ name: 'hello' });
  });

  it('should parse nested YAML', async () => {
    const yaml = `
server:
  host: localhost
  port: 8080
`;
    const result = await parseYaml<{ server: { host: string; port: number } }>(
      yaml
    );
    expect(result).toEqual({ server: { host: 'localhost', port: 8080 } });
  });

  it('should parse YAML arrays', async () => {
    const yaml = `
- one
- two
- three
`;
    const result = await parseYaml<string[]>(yaml);
    expect(result).toEqual(['one', 'two', 'three']);
  });

  it('should parse empty content as null', async () => {
    const result = await parseYaml('');
    expect(result).toBeNull();
  });

  it('should throw YamlParseError on invalid YAML', async () => {
    await expect(parseYaml('"unterminated')).rejects.toThrow(YamlParseError);
  });

  it('should include filePath in error when provided', async () => {
    try {
      await parseYaml('"unterminated', '/path/to/file.yml');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(YamlParseError);
      expect((e as YamlParseError).filePath).toBe('/path/to/file.yml');
    }
  });

  it('should parse scalar values', async () => {
    expect(await parseYaml('42')).toBe(42);
    expect(await parseYaml('true')).toBe(true);
    expect(await parseYaml('"hello"')).toBe('hello');
  });
});

describe('tryParseYaml', () => {
  it('should return success for valid YAML', async () => {
    const result = await tryParseYaml<{ key: string }>('key: value');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' });
    }
  });

  it('should return failure for invalid YAML', async () => {
    const result = await tryParseYaml('"unterminated');
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error).toBeInstanceOf(YamlParseError);
    }
  });

  it('should include filePath in error result', async () => {
    const result = await tryParseYaml('"unterminated', '/my/file.yml');
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.filePath).toBe('/my/file.yml');
    }
  });
});
