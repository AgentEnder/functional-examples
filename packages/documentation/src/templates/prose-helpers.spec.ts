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
    it('should return a FileAccessor whose toString() produces a fenced code block', () => {
      const files = [makeFile('utils.ts', 'export const x = 1;')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const accessor = helpers.file('utils.ts');

      expect(accessor.toString()).toBe('```typescript title="utils.ts"\nexport const x = 1;\n```');
    });

    it('should produce correct output via string coercion (Eta compat)', () => {
      const files = [makeFile('utils.ts', 'export const x = 1;')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = `${helpers.file('utils.ts')}`;

      expect(result).toBe('```typescript title="utils.ts"\nexport const x = 1;\n```');
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

      const result = helpers.file('data.json').toString();

      expect(result).toBe('```json title="data.json"\n{"key": "value"}\n```');
    });

    it('should detect language from file extension', () => {
      const files = [makeFile('style.css', 'body { color: red; }')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.file('style.css').toString();

      expect(result).toContain('```css');
    });

    it('should allow chaining .region() to scope region lookup to the file', () => {
      const files = [
        makeFile('auth.ts', 'auth code', [
          { id: 'middleware', content: 'auth middleware', startLine: 1, endLine: 2 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.file('auth.ts').region('middleware');

      expect(result).toBe('```typescript title="auth.ts#middleware"\nauth middleware\n```');
    });

    it('file().region() should mark the file as consumed', () => {
      const files = [
        makeFile('auth.ts', 'auth code', [
          { id: 'middleware', content: 'auth middleware', startLine: 1, endLine: 2 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      helpers.file('auth.ts').region('middleware');

      expect(tracker.isConsumed('auth.ts')).toBe(true);
    });

    it('file().region() should throw on unknown region ID', () => {
      const files = [makeFile('auth.ts', 'auth code')];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      expect(() => helpers.file('auth.ts').region('nonexistent')).toThrow(
        /no region found with id "nonexistent"/
      );
    });
  });

  describe('region()', () => {
    it('should return a fenced code block for the region with title', () => {
      const files = [
        makeFile('main.ts', '// full file', [
          { id: 'setup', content: 'const x = 1;', startLine: 1, endLine: 3 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      const result = helpers.region('setup');

      expect(result).toBe('```typescript title="main.ts#setup"\nconst x = 1;\n```');
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

      expect(result).toBe('```typescript title="b.ts#init"\ninit code\n```');
      expect(tracker.isConsumed('b.ts')).toBe(true);
      expect(tracker.isConsumed('a.ts')).toBe(false);
    });

    it('should throw when region id is ambiguous across files', () => {
      const files = [
        makeFile('auth.ts', 'auth code', [
          { id: 'middleware', content: 'auth()', startLine: 1, endLine: 2 },
        ]),
        makeFile('timing.ts', 'timing code', [
          { id: 'middleware', content: 'timing()', startLine: 1, endLine: 2 },
        ]),
      ];
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers(files, tracker);

      expect(() => helpers.region('middleware')).toThrow(/ambiguous/);
    });
  });

  describe('metadata', () => {
    it('should expose metadata values', () => {
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers([], tracker, {
        category: 'guides',
        difficulty: 'beginner',
      });

      expect(helpers.metadata.category).toBe('guides');
      expect(helpers.metadata.difficulty).toBe('beginner');
    });

    it('should throw for access to undefined metadata properties', () => {
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers([], tracker, { category: 'guides' });

      expect(() => helpers.metadata.nonexistent).toThrow(
        'metadata.nonexistent is not defined'
      );
    });

    it('should default to empty metadata when not provided', () => {
      const tracker = new ConsumptionTracker();
      const helpers = createProseHelpers([], tracker);

      expect(() => helpers.metadata.anything).toThrow(
        'metadata.anything is not defined'
      );
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
