import { describe, expect, it } from 'vitest';
import { DEFAULT_REGION_EXTENSION_MAP } from './defaults.js';
import { extractRegionFromFileContent } from './parser.js';

const TS_MAP = {
  '.ts': DEFAULT_REGION_EXTENSION_MAP['.ts'],
};

const PY_MAP = {
  '.py': DEFAULT_REGION_EXTENSION_MAP['.py'],
};

describe('extractRegionFromFileContent', () => {
  describe('extension not in map', () => {
    it('returns empty hunks and original content for unknown extension', () => {
      const content = 'hello\nworld';
      const result = extractRegionFromFileContent(
        content,
        'file.txt',
        {},
        'region',
        'endregion'
      );
      expect(result.hunks).toEqual([]);
      expect(result.parsed).toBe(content);
    });
  });

  describe('TypeScript line comments', () => {
    it('extracts a single region', () => {
      const content = [
        'const a = 1;',
        '// #region setup',
        'const b = 2;',
        '// #endregion setup',
        'const c = 3;',
      ].join('\n');

      const { hunks, parsed } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
      expect(hunks[0].content).toBe('const b = 2;');
      expect(hunks[0].startLine).toBe(2);
      expect(hunks[0].endLine).toBe(4);
      expect(parsed).toBe('const a = 1;\nconst b = 2;\nconst c = 3;');
    });

    it('extracts multiple regions', () => {
      const content = [
        '// #region alpha',
        'const a = 1;',
        '// #endregion alpha',
        '// #region beta',
        'const b = 2;',
        '// #endregion beta',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(2);
      expect(hunks[0].id).toBe('alpha');
      expect(hunks[1].id).toBe('beta');
    });

    it('extracts hyphenated region IDs', () => {
      const content = [
        '// #region snapshot-test',
        'const output = "ok";',
        '// #endregion snapshot-test',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('snapshot-test');
      expect(hunks[0].content).toBe('const output = "ok";');
    });

    it('strips region marker lines from parsed output', () => {
      const content = [
        '// #region example',
        'const x = 42;',
        '// #endregion example',
      ].join('\n');

      const { parsed } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(parsed).toBe('const x = 42;');
      expect(parsed).not.toContain('region');
    });

    it('handles#endregion without an ID', () => {
      const content = [
        '// #region myRegion',
        'const x = 1;',
        '// #endregion',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('myRegion');
    });

    it('handles nested regions', () => {
      const content = [
        '// #region outer',
        'const a = 1;',
        '// #region inner',
        'const b = 2;',
        '// #endregion inner',
        'const c = 3;',
        '// #endregion outer',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(2);
      const outer = hunks.find((h) => h.id === 'outer');
      const inner = hunks.find((h) => h.id === 'inner');
      if (!outer || !inner) throw new Error('Expected both hunks');
      expect(outer.content).toContain('const a = 1;');
      expect(outer.content).toContain('const b = 2;');
      expect(inner.content).toBe('const b = 2;');
    });

    it('ignores end-marker ID — always pops the innermost open region', () => {
      // The parser is stack-based and does not validate that the end-marker ID
      // matches the most-recently-opened region. This is intentional and matches
      // VS Code folding behavior.
      const content = [
        '// #region alpha',
        'const a = 1;',
        '// #region beta',
        'const b = 2;',
        '// #endregion alpha', // mismatched — closes beta (top of stack)
        'const c = 3;',
        '// #endregion beta', // mismatched — closes alpha
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(2);
      // beta was on top of stack, so it gets closed first
      expect(hunks[0].id).toBe('beta');
      expect(hunks[0].content).toBe('const b = 2;');
      // alpha closes second, containing everything between its open and its close
      expect(hunks[1].id).toBe('alpha');
      expect(hunks[1].content).toContain('const a = 1;');
      expect(hunks[1].content).toContain('const b = 2;');
    });
  });

  describe('TypeScript block comments', () => {
    it('extracts region from block comment syntax', () => {
      const content = [
        '/* region blockExample */',
        'const x = 1;',
        '/*#endregion blockExample */',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        TS_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('blockExample');
    });
  });

  describe('Python hash comments', () => {
    it('extracts region from Python hash comment syntax', () => {
      const content = ['# region setup', 'x = 1', '##endregion setup'].join(
        '\n'
      );

      const { hunks, parsed } = extractRegionFromFileContent(
        content,
        'script.py',
        PY_MAP,
        'region',
        'endregion'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
      expect(hunks[0].content).toBe('x = 1');
      expect(parsed).toBe('x = 1');
    });

    it('does not match TypeScript patterns for .py files', () => {
      const content = [
        '// #region tsStyle',
        'x = 1',
        '// #endregion tsStyle',
      ].join('\n');

      const { hunks } = extractRegionFromFileContent(
        content,
        'script.py',
        PY_MAP,
        'region',
        'endregion'
      );

      // // comments are not Python style — no match
      expect(hunks).toHaveLength(0);
    });
  });

  describe('custom startTag / endTag', () => {
    it('respects custom tags', () => {
      const customMap = { '.ts': DEFAULT_REGION_EXTENSION_MAP['.ts'] };
      const content = ['// mark setup', 'const x = 1;', '// unmark setup'].join(
        '\n'
      );

      const { hunks } = extractRegionFromFileContent(
        content,
        'main.ts',
        customMap,
        'mark',
        'unmark'
      );

      expect(hunks).toHaveLength(1);
      expect(hunks[0].id).toBe('setup');
    });
  });
});
