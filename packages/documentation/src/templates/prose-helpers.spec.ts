import { describe, it, expect } from 'vitest';
import { ExampleFile } from '@functional-examples/devkit';
import type { ParsedRegion } from '@functional-examples/devkit';
import { ConsumptionTracker } from './consumption-tracker.js';
import { createProseHelpers } from './prose-helpers.js';

function makeFile(relativePath: string, content: string, hunks?: ParsedRegion[]): ExampleFile {
  return new ExampleFile({
    absolutePath: `/tmp/test/${relativePath}`,
    relativePath,
    raw: content,
    parsed: content,
    hunks,
  });
}

describe('createProseHelpers', () => {
  describe('file()', () => {
    it('should return a fenced code block for the file', () => {
      const files = [makeFile('utils.ts', 'export const x = 1;')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.file('utils.ts');

      expect(result).toBe('```typescript\nexport const x = 1;\n```');
    });

    it('should mark the file as consumed', () => {
      const files = [makeFile('utils.ts', 'export const x = 1;')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      helpers.file('utils.ts');

      expect(tracker.isConsumed('utils.ts')).toBe(true);
    });

    it('should throw for unknown file paths', () => {
      const files = [makeFile('utils.ts', 'code')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      expect(() => helpers.file('nonexistent.ts')).toThrow(
        'no file found with relativePath "nonexistent.ts"'
      );
    });

    it('should use raw content when parsed is not available', () => {
      const file = new ExampleFile({
        absolutePath: '/tmp/test/data.json',
        relativePath: 'data.json',
        raw: '{"key": "value"}',
      });
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers([file], tracker);

      const result = helpers.file('data.json');

      expect(result).toBe('```json\n{"key": "value"}\n```');
    });

    it('should detect language from file extension', () => {
      const files = [makeFile('style.css', 'body { color: red; }')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.file('style.css');

      expect(result).toContain('```css');
    });
  });

  describe('region()', () => {
    it('should return a fenced code block for the region', () => {
      const files = [
        makeFile('main.ts', '// full file', [
          { id: 'setup', content: 'const x = 1;', startLine: 1, endLine: 3 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.region('setup');

      expect(result).toBe('```typescript\nconst x = 1;\n```');
    });

    it('should mark the parent file as consumed', () => {
      const files = [
        makeFile('main.ts', '// full file', [
          { id: 'setup', content: 'const x = 1;', startLine: 1, endLine: 3 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      helpers.region('setup');

      expect(tracker.isConsumed('main.ts')).toBe(true);
    });

    it('should throw for unknown region IDs', () => {
      const files = [makeFile('main.ts', 'code')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      expect(() => helpers.region('nonexistent')).toThrow(
        'no region found with id "nonexistent"'
      );
    });

    it('should find regions across multiple files', () => {
      const files = [
        makeFile('a.ts', 'file a'),
        makeFile('b.ts', 'file b', [
          { id: 'init', content: 'init code', startLine: 1, endLine: 2 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.region('init');

      expect(result).toBe('```typescript\ninit code\n```');
      expect(tracker.isConsumed('b.ts')).toBe(true);
      expect(tracker.isConsumed('a.ts')).toBe(false);
    });
  });

  describe('passthrough properties', () => {
    it('should expose the files array', () => {
      const files = [makeFile('a.ts', 'code')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      expect(helpers.files).toBe(files);
    });

    it('should expose standard template helpers', () => {
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers([], tracker);

      expect(helpers.helpers.langFromPath).toBeTypeOf('function');
      expect(helpers.helpers.slugify).toBeTypeOf('function');
      expect(helpers.helpers.isProseFile).toBeTypeOf('function');
    });
  });
});
