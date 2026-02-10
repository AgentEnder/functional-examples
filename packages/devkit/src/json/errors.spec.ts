import { describe, it, expect } from 'vitest';

import {
  positionToLineColumn,
  extractErrorPosition,
  buildCodeFrame,
  formatJsonError,
} from './errors.js';

describe('positionToLineColumn', () => {
  it('should convert offset 0 to line 1, column 1', () => {
    const result = positionToLineColumn('hello', 0);
    expect(result).toEqual({ line: 1, column: 1 });
  });

  it('should convert offset in the first line', () => {
    const result = positionToLineColumn('hello world', 5);
    expect(result).toEqual({ line: 1, column: 6 });
  });

  it('should convert offset on the second line', () => {
    const content = 'line1\nline2';
    // offset 6 = first char of line 2
    const result = positionToLineColumn(content, 6);
    expect(result).toEqual({ line: 2, column: 1 });
  });

  it('should handle offset at end of content', () => {
    const content = 'ab\ncd\nef';
    // offset 8 = past last char
    const result = positionToLineColumn(content, 8);
    expect(result).toEqual({ line: 3, column: 3 });
  });

  it('should clamp offset beyond content length', () => {
    const content = 'abc';
    const result = positionToLineColumn(content, 100);
    expect(result).toEqual({ line: 1, column: 4 });
  });

  it('should clamp negative offset to 0', () => {
    const content = 'abc';
    const result = positionToLineColumn(content, -5);
    expect(result).toEqual({ line: 1, column: 1 });
  });

  it('should handle multi-line content correctly', () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n  "ok": true\n}';
    // offset at the comma after "bad": which is position 28
    const result = positionToLineColumn(content, 28);
    expect(result.line).toBe(3);
  });
});

describe('extractErrorPosition', () => {
  it('should extract from json5-style errors with lineNumber/columnNumber', () => {
    const error = Object.assign(new Error('JSON5: invalid character'), {
      lineNumber: 3,
      columnNumber: 10,
    });

    const result = extractErrorPosition(error);
    expect(result).toEqual({ line: 3, column: 10 });
  });

  it('should extract from Node.js "at line X column Y" errors', () => {
    const error = new Error(
      'Expected double-quoted property name in JSON at line 3 column 5'
    );

    const result = extractErrorPosition(error);
    expect(result).toEqual({ line: 3, column: 5 });
  });

  it('should extract from Node.js "at position N" errors and convert', () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n}';
    const error = new Error('Unexpected token , in JSON at position 28');

    const result = extractErrorPosition(error, content);
    expect(result.line).toBeDefined();
    expect(result.column).toBeDefined();
    expect(result.line).toBe(3);
  });

  it('should return empty object for unrecognized error format', () => {
    const error = new Error('Something went wrong');
    const result = extractErrorPosition(error);
    expect(result).toEqual({});
  });

  it('should return empty for position error without content', () => {
    const error = new Error('Unexpected token at position 10');
    const result = extractErrorPosition(error);
    expect(result).toEqual({});
  });
});

describe('buildCodeFrame', () => {
  const content = [
    '{',
    '  "name": "foo",',
    '  "bad": ,',
    '  "ok": true',
    '}',
  ].join('\n');

  it('should show the error line with > marker', () => {
    const frame = buildCodeFrame(content, 3);
    const lines = frame.split('\n');
    const errorLine = lines.find((l) => l.startsWith('>'));
    expect(errorLine).toBeDefined();
    expect(errorLine).toContain('"bad": ,');
  });

  it('should show context lines before and after', () => {
    const frame = buildCodeFrame(content, 3);
    expect(frame).toContain('"name": "foo"');
    expect(frame).toContain('"ok": true');
  });

  it('should show a ^ pointer at the column', () => {
    const frame = buildCodeFrame(content, 3, 10);
    expect(frame).toContain('^');
  });

  it('should not show ^ when column is not provided', () => {
    const frame = buildCodeFrame(content, 3);
    expect(frame).not.toContain('^');
  });

  it('should handle error on the first line', () => {
    const frame = buildCodeFrame(content, 1, 1);
    const lines = frame.split('\n');
    const markerLine = lines.find((l) => l.startsWith('>'));
    expect(markerLine).toBeDefined();
    expect(markerLine).toContain('{');
  });

  it('should handle error on the last line', () => {
    const frame = buildCodeFrame(content, 5, 1);
    const lines = frame.split('\n');
    const markerLine = lines.find((l) => l.startsWith('>'));
    expect(markerLine).toBeDefined();
    expect(markerLine).toContain('}');
  });

  it('should include line numbers', () => {
    const frame = buildCodeFrame(content, 3, 10);
    expect(frame).toMatch(/\d+ \|/);
  });
});

describe('formatJsonError', () => {
  it('should produce a readable error with file path and location', () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n  "ok": true\n}';
    const error = new Error(
      'Expected double-quoted property name in JSON at line 3 column 10'
    );

    const result = formatJsonError({
      content,
      error,
      filePath: 'config.json',
    });

    expect(result.message).toContain('Failed to parse JSON');
    expect(result.message).toContain('config.json');
    expect(result.message).toContain('3');
    expect(result.line).toBe(3);
    expect(result.column).toBe(10);
  });

  it('should include a code frame when position is known', () => {
    const content = '{\n  "name": "foo",\n  "bad": ,\n  "ok": true\n}';
    const error = new Error(
      'Expected double-quoted property name in JSON at line 3 column 10'
    );

    const result = formatJsonError({ content, error });
    expect(result.message).toContain('"bad": ,');
    expect(result.message).toContain('^');
  });

  it('should work without file path', () => {
    const content = '{\n  bad\n}';
    const error = new Error('Unexpected token b at position 4');

    const result = formatJsonError({ content, error });
    expect(result.message).toContain('Failed to parse JSON:');
    expect(result.message).not.toContain('(undefined');
  });

  it('should handle errors with no extractable position', () => {
    const content = 'invalid';
    const error = new Error('Something went wrong');

    const result = formatJsonError({ content, error });
    expect(result.message).toContain('Failed to parse JSON');
    expect(result.message).toContain('Something went wrong');
    expect(result.line).toBeUndefined();
    expect(result.column).toBeUndefined();
  });
});
