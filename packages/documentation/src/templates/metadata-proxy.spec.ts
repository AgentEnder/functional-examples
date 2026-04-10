import { describe, it, expect } from 'vitest';
import { createMetadataProxy } from './metadata-proxy.js';

describe('createMetadataProxy', () => {
  describe('defined properties', () => {
    it('should return values for own properties', () => {
      const proxy = createMetadataProxy({ category: 'guides', level: 3 });

      expect(proxy.category).toBe('guides');
      expect(proxy.level).toBe(3);
    });

    it('should return null without throwing', () => {
      const proxy = createMetadataProxy({ optional: null });

      expect(proxy.optional).toBeNull();
    });

    it('should return arrays directly (not proxied)', () => {
      const tags = ['a', 'b'];
      const proxy = createMetadataProxy({ tags });

      expect(proxy.tags).toEqual(['a', 'b']);
      expect(Array.isArray(proxy.tags)).toBe(true);
    });

    it('should return boolean false without throwing', () => {
      const proxy = createMetadataProxy({ draft: false });

      expect(proxy.draft).toBe(false);
    });

    it('should return empty string without throwing', () => {
      const proxy = createMetadataProxy({ label: '' });

      expect(proxy.label).toBe('');
    });
  });

  describe('undefined properties', () => {
    it('should throw for access to a missing property', () => {
      const proxy = createMetadataProxy({ category: 'guides' });

      expect(() => (proxy as Record<string, unknown>).typo).toThrow(
        'metadata.typo is not defined'
      );
    });

    it('should include available keys in the error message', () => {
      const proxy = createMetadataProxy({ category: 'guides', level: 3 });

      expect(() => (proxy as Record<string, unknown>).missing).toThrow(
        'Available properties: category, level'
      );
    });

    it('should report (none) when metadata is empty', () => {
      const proxy = createMetadataProxy({});

      expect(() => (proxy as Record<string, unknown>).anything).toThrow(
        'Available properties: (none)'
      );
    });
  });

  describe('nested objects', () => {
    it('should recursively proxy nested plain objects', () => {
      const proxy = createMetadataProxy({
        docs: { hunks: { setup: 'Initialize config' } },
      });

      const docs = proxy.docs as Record<string, unknown>;
      const hunks = docs.hunks as Record<string, unknown>;
      expect(hunks.setup).toBe('Initialize config');
    });

    it('should throw for missing nested properties with full path', () => {
      const proxy = createMetadataProxy({
        docs: { hunks: { setup: 'desc' } },
      });

      const docs = proxy.docs as Record<string, unknown>;
      const hunks = docs.hunks as Record<string, unknown>;

      expect(() => hunks.nonexistent).toThrow(
        'metadata.docs.hunks.nonexistent is not defined'
      );
    });

    it('should throw at the first missing level', () => {
      const proxy = createMetadataProxy({ docs: { hunks: {} } });
      const docs = proxy.docs as Record<string, unknown>;

      expect(() => docs.missing).toThrow('metadata.docs.missing is not defined');
    });
  });

  describe('custom path prefix', () => {
    it('should use the provided path in error messages', () => {
      const proxy = createMetadataProxy(
        { a: 1 },
        "example('basic').metadata"
      );

      expect(() => (proxy as Record<string, unknown>).missing).toThrow(
        "example('basic').metadata.missing is not defined"
      );
    });
  });

  describe('passthrough properties', () => {
    it('should not throw for Symbol access', () => {
      const proxy = createMetadataProxy({});

      expect(() => (proxy as Record<symbol, unknown>)[Symbol.toPrimitive]).not.toThrow();
    });

    it('should not throw for Object.prototype members', () => {
      const proxy = createMetadataProxy({});

      expect(() => proxy.toString()).not.toThrow();
      expect(() => proxy.valueOf()).not.toThrow();
    });

    it('should not throw for "then" (thenable detection)', () => {
      const proxy = createMetadataProxy({});

      expect(proxy.then).toBeUndefined();
    });

    it('should not throw for "toJSON"', () => {
      const proxy = createMetadataProxy({});

      expect(proxy.toJSON).toBeUndefined();
    });
  });

  describe('enumeration', () => {
    it('should support Object.keys()', () => {
      const proxy = createMetadataProxy({ a: 1, b: 2 });

      expect(Object.keys(proxy)).toEqual(['a', 'b']);
    });

    it('should support for..in', () => {
      const proxy = createMetadataProxy({ x: 10, y: 20 });
      const keys: string[] = [];
      for (const k in proxy) {
        if (Object.prototype.hasOwnProperty.call(proxy, k)) {
          keys.push(k);
        }
      }
      expect(keys).toEqual(['x', 'y']);
    });
  });
});
