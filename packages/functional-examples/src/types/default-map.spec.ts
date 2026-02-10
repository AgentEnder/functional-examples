import { describe, it, expect } from 'vitest';
import { DefaultMap } from './default-map.js';

describe('DefaultMap', () => {
  it('should return existing value for known key', () => {
    const map = new DefaultMap<string, number>(() => 0);
    map.set('existing', 42);

    expect(map.get('existing')).toBe(42);
  });

  it('should create and store default value for missing key', () => {
    const map = new DefaultMap<string, number[]>(() => []);

    const result = map.get('missing');

    expect(result).toEqual([]);
    expect(map.has('missing')).toBe(true);
  });

  it('should return same instance on subsequent gets', () => {
    const map = new DefaultMap<string, number[]>(() => []);

    const first = map.get('key');
    first.push(1);
    const second = map.get('key');

    expect(second).toBe(first);
    expect(second).toEqual([1]);
  });

  it('should call factory for each new key', () => {
    let callCount = 0;
    const map = new DefaultMap<string, object>(() => {
      callCount++;
      return {};
    });

    map.get('a');
    map.get('b');
    map.get('a'); // Should not call factory again

    expect(callCount).toBe(2);
  });

  it('should work with nested DefaultMaps', () => {
    const map = new DefaultMap<string, DefaultMap<string, number[]>>(
      () => new DefaultMap<string, number[]>(() => [])
    );

    map.get('outer').get('inner').push(1);
    map.get('outer').get('inner').push(2);
    map.get('outer').get('other').push(3);

    expect(map.get('outer').get('inner')).toEqual([1, 2]);
    expect(map.get('outer').get('other')).toEqual([3]);
  });

  it('should inherit Map methods', () => {
    const map = new DefaultMap<string, number>(() => 0);
    map.set('a', 1);
    map.set('b', 2);

    expect(map.size).toBe(2);
    expect([...map.keys()]).toEqual(['a', 'b']);
    expect([...map.values()]).toEqual([1, 2]);
    expect([...map.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('should handle delete correctly', () => {
    const map = new DefaultMap<string, number>(() => 99);
    map.get('key'); // Creates default
    map.delete('key');

    // Should create new default after delete
    expect(map.get('key')).toBe(99);
    expect(map.size).toBe(1);
  });

  it('should handle undefined default value correctly', () => {
    // Edge case: factory returns undefined - get() will keep creating new defaults
    // This is documented behavior: we only check for undefined, not has()
    const map = new DefaultMap<string, undefined>(() => undefined);

    map.get('key');

    // The value is stored but get() will recreate it each time
    expect(map.has('key')).toBe(true);
  });
});
