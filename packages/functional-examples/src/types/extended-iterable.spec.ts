import { describe, expect, it } from 'vitest';
import {
  AsyncExtendedIterable,
  ExtendedIterable,
  iter,
} from './extended-iterable.js';

describe('ExtendedIterable', () => {
  describe('flat', () => {
    it('should flatten one level of nested arrays', () => {
      const iter = new ExtendedIterable([[1, 2], [3, 4], [5]]);

      const result = iter.flat().collect();

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle mixed nested and non-nested elements', () => {
      const iter = new ExtendedIterable([[1, 2], 3, [4, 5]]);

      const result = iter.flat().collect();

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty nested arrays', () => {
      const iter = new ExtendedIterable([[], [1, 2], [], [3]]);

      const result = iter.flat().collect();

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle empty source', () => {
      const iter = new ExtendedIterable<number[]>([]);

      const result = iter.flat().collect();

      expect(result).toEqual([]);
    });

    it('should only flatten one level', () => {
      const iter = new ExtendedIterable([[[1, 2]], [[3]], [4, 5]]);

      const result = iter.flat().collect();

      // Only flattens one level - inner arrays remain
      expect(result).toEqual([[1, 2], [3], 4, 5]);
    });

    it('should work with other iterables like Sets', () => {
      const iter = new ExtendedIterable([new Set([1, 2]), new Set([3, 4])]);

      const result = iter.flat().collect();

      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should chain with other operations', () => {
      const iter = new ExtendedIterable([
        [1, 2],
        [3, 4],
      ]);

      const result = iter
        .flat()
        .map((x) => (x as number) * 10)
        .collect();

      expect(result).toEqual([10, 20, 30, 40]);
    });

    it('should not split strings into characters', () => {
      const iter = new ExtendedIterable([['hello', 'world'], ['foo']]);

      const result = iter.flat().collect();

      expect(result).toEqual(['hello', 'world', 'foo']);
    });

    it('should handle mixed strings and arrays', () => {
      const iter = new ExtendedIterable([['a', 'b'], 'c', ['d']]);

      const result = iter.flat().collect();

      // Strings at top level stay intact, arrays get flattened one level
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('map', () => {
    it('should transform each element', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter.map((x) => x * 2).collect();

      expect(result).toEqual([2, 4, 6]);
    });

    it('should be lazy - not evaluate until collected', () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3]);

      const mapped = iter.map((x) => {
        callCount++;
        return x * 2;
      });

      expect(callCount).toBe(0);

      mapped.collect();

      expect(callCount).toBe(3);
    });

    it('should allow chaining multiple maps', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter
        .map((x) => x + 1)
        .map((x) => x * 2)
        .collect();

      expect(result).toEqual([4, 6, 8]);
    });
  });

  describe('filter', () => {
    it('should filter elements by predicate', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter.filter((x) => x % 2 === 0).collect();

      expect(result).toEqual([2, 4]);
    });

    it('should be lazy - not evaluate until collected', () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3]);

      const filtered = iter.filter((x) => {
        callCount++;
        return x > 1;
      });

      expect(callCount).toBe(0);

      filtered.collect();

      expect(callCount).toBe(3);
    });

    it('should chain with map', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter
        .filter((x) => x % 2 === 0)
        .map((x) => x * 10)
        .collect();

      expect(result).toEqual([20, 40]);
    });

    it('should return empty for no matches', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter.filter((x) => x > 10).collect();

      expect(result).toEqual([]);
    });
  });

  describe('take', () => {
    it('should take first n elements', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter.take(3).collect();

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle taking more than available', () => {
      const iter = new ExtendedIterable([1, 2]);

      const result = iter.take(5).collect();

      expect(result).toEqual([1, 2]);
    });

    it('should take zero elements', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter.take(0).collect();

      expect(result).toEqual([]);
    });

    it('should stop iteration early', () => {
      let count = 0;
      function* infiniteGen() {
        while (true) {
          count++;
          yield count;
        }
      }

      const iter = new ExtendedIterable(infiniteGen());
      const result = iter.take(3).collect();

      expect(result).toEqual([1, 2, 3]);
      // TakeIterator checks count before calling source.next(),
      // so it doesn't pull an extra element from the generator.
      expect(count).toBe(3);
    });

    it('should chain with filter and map', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const result = iter
        .filter((x) => x % 2 === 0)
        .map((x) => x * 10)
        .take(2)
        .collect();

      expect(result).toEqual([20, 40]);
    });
  });

  describe('some', () => {
    it('should return true when predicate matches any element', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      expect(iter.some((x) => x > 3)).toBe(true);
    });

    it('should return false when no elements match', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      expect(iter.some((x) => x > 10)).toBe(false);
    });

    it('should short-circuit on first match', () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      iter.some((x) => {
        callCount++;
        return x === 2;
      });

      expect(callCount).toBe(2);
    });

    it('should return false for empty iterable', () => {
      const iter = new ExtendedIterable<number>([]);

      expect(iter.some((x) => x > 0)).toBe(false);
    });

    it('should return Promise<true> with async predicate that matches', async () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter.some(async (x) => x > 3);

      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(true);
    });

    it('should return Promise<false> with async predicate that does not match', async () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      expect(await iter.some(async (x) => x > 10)).toBe(false);
    });

    it('should short-circuit with async predicate', async () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      await iter.some(async (x) => {
        callCount++;
        return x === 2;
      });

      expect(callCount).toBe(2);
    });
  });

  describe('find', () => {
    it('should return first matching element', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      expect(iter.find((x) => x > 2)).toBe(3);
    });

    it('should return undefined when no match', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      expect(iter.find((x) => x > 10)).toBeUndefined();
    });

    it('should short-circuit on first match', () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      iter.find((x) => {
        callCount++;
        return x === 3;
      });

      expect(callCount).toBe(3);
    });

    it('should return undefined for empty iterable', () => {
      const iter = new ExtendedIterable<number>([]);

      expect(iter.find((x) => x > 0)).toBeUndefined();
    });

    it('should work after chaining', () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter.map((x) => x * 10).find((x) => x > 25);

      expect(result).toBe(30);
    });

    it('should return Promise with async predicate that matches', async () => {
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      const result = iter.find(async (x) => x > 2);

      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(3);
    });

    it('should return Promise<undefined> with async predicate no match', async () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      expect(await iter.find(async (x) => x > 10)).toBeUndefined();
    });

    it('should short-circuit with async predicate', async () => {
      let callCount = 0;
      const iter = new ExtendedIterable([1, 2, 3, 4, 5]);

      await iter.find(async (x) => {
        callCount++;
        return x === 3;
      });

      expect(callCount).toBe(3);
    });
  });

  describe('splice', () => {
    it('should work with simple case', () => {
      const { deleted, sliced } = iter([1, 2, 3, 4, 5]).splice(
        (el) => el === 3,
        2,
        iter([10, 20])
      );

      expect(sliced.collect()).toEqual([1, 2, 10, 20, 5]);
      expect(deleted.collect()).toEqual([3, 4]);
    });

    it('should work with chained map operations', () => {
      let sum = 0;
      const { deleted, sliced } = iter([3, 6, 9])
        .map((x) => {
          // this doesn't really make sense to do here, but we are
          // using it to assert that the map ran properly on each element
          // and only once on each element that was consumed
          sum += x * 2;
          return x * 2;
        })
        .splice((el) => el == 12, 2, iter([-6])); // when you see el == 4, drop the next 2 and insert the element -3

      // sliced should contain [6, -6] - we saw 12 at 6*2, and dropped it and the next el, and inserted -6.
      expect(sliced.map((x) => x / 3).collect()).toEqual([2, -2]);
      // deleted should be [12, 18] // we saw 12 at 6*2 and consumed it + the next el
      expect(deleted.map((x) => x / 6).collect()).toEqual([2, 3]);
      // 3*2 + 6*2 + 9*2 since both deleted + sliced were collected.
      expect(sum).toEqual(36);
    });
  });

  describe('collect', () => {
    it('should convert iterable to array', () => {
      const iter = new ExtendedIterable(new Set([1, 2, 3]));

      const result = iter.collect();

      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty iterable', () => {
      const iter = new ExtendedIterable([]);

      expect(iter.collect()).toEqual([]);
    });
  });

  describe('join', () => {
    it('should join elements with separator', () => {
      const iter = new ExtendedIterable(['a', 'b', 'c']);

      const result = iter.join(', ');

      expect(result).toBe('a, b, c');
    });

    it('should handle single element', () => {
      const iter = new ExtendedIterable(['only']);

      const result = iter.join(', ');

      expect(result).toBe('only');
    });

    it('should return empty string for empty iterable', () => {
      const iter = new ExtendedIterable<string>([]);

      const result = iter.join(', ');

      expect(result).toBe('');
    });

    it('should convert non-string elements', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter.join('-');

      expect(result).toBe('1-2-3');
    });

    it('should work with objects that have toString', () => {
      const objects = [{ toString: () => 'A' }, { toString: () => 'B' }];
      const iter = new ExtendedIterable(objects);

      const result = iter.join('|');

      expect(result).toBe('A|B');
    });
  });

  describe('reduce', () => {
    it('should reduce with initial value', () => {
      const result = new ExtendedIterable([1, 2, 3]).reduce(
        (sum, n) => sum + n,
        0
      );

      expect(result).toBe(6);
    });

    it('should reduce without initial value using first element', () => {
      const result = new ExtendedIterable([1, 2, 3]).reduce(
        (sum, n) => sum + n
      );

      expect(result).toBe(6);
    });

    it('should return initial value for empty iterable', () => {
      const result = new ExtendedIterable<number>([]).reduce(
        (sum, n) => sum + n,
        42
      );

      expect(result).toBe(42);
    });

    it('should throw TypeError for empty iterable without initial value', () => {
      expect(() =>
        new ExtendedIterable<number>([]).reduce((sum, n) => sum + n)
      ).toThrow(TypeError);
    });

    it('should return single element when no initial value', () => {
      const result = new ExtendedIterable([99]).reduce(
        (sum, n) => sum + n
      );

      expect(result).toBe(99);
    });

    it('should support changing accumulator type with initial value', () => {
      const result = new ExtendedIterable(['a', 'b', 'c']).reduce(
        (acc, val) => ({ ...acc, [val]: true }),
        {} as Record<string, boolean>
      );

      expect(result).toEqual({ a: true, b: true, c: true });
    });

    it('should match Array.reduce behavior', () => {
      const arr = [10, 20, 30, 40];
      const fn = (acc: number, val: number) => acc - val;

      const extended = new ExtendedIterable(arr).reduce(fn);
      const native = arr.reduce(fn);

      expect(extended).toBe(native);
    });
  });

  describe('prefix', () => {
    it('should prepend elements from another iterable', () => {
      const iter = new ExtendedIterable([3, 4, 5]);

      const result = iter.prefix([1, 2]).collect();

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty prefix', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = iter.prefix([]).collect();

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle empty source', () => {
      const iter = new ExtendedIterable<number>([]);

      const result = iter.prefix([1, 2]).collect();

      expect(result).toEqual([1, 2]);
    });

    it('should be lazy - not evaluate until collected', () => {
      let prefixCalls = 0;
      let sourceCalls = 0;

      function* prefixGen(): Generator<number> {
        prefixCalls++;
        yield 1;
        prefixCalls++;
        yield 2;
      }

      function* sourceGen(): Generator<number> {
        sourceCalls++;
        yield 3;
        sourceCalls++;
        yield 4;
      }

      const iter = new ExtendedIterable(sourceGen());
      const prefixed = iter.prefix(prefixGen());

      expect(prefixCalls).toBe(0);
      expect(sourceCalls).toBe(0);

      prefixed.collect();

      expect(prefixCalls).toBe(2);
      expect(sourceCalls).toBe(2);
    });

    it('should chain with other operations', () => {
      const iter = new ExtendedIterable([4, 5, 6]);

      const result = iter
        .prefix([1, 2, 3])
        .map((x) => x * 10)
        .filter((x) => x > 20)
        .collect();

      expect(result).toEqual([30, 40, 50, 60]);
    });

    it('should allow multiple prefixes', () => {
      const iter = new ExtendedIterable([5, 6]);

      const result = iter.prefix([3, 4]).prefix([1, 2]).collect();

      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should work with different iterable types', () => {
      const iter = new ExtendedIterable([3, 4]);

      const result = iter.prefix(new Set([1, 2])).collect();

      expect(result).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Symbol.iterator', () => {
    it('should be iterable with for-of', () => {
      const iter = new ExtendedIterable([1, 2, 3]);
      const result: number[] = [];

      for (const val of iter) {
        result.push(val);
      }

      expect(result).toEqual([1, 2, 3]);
    });

    it('should work with spread operator', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = [...iter];

      expect(result).toEqual([1, 2, 3]);
    });

    it('should work with Array.from', () => {
      const iter = new ExtendedIterable([1, 2, 3]);

      const result = Array.from(iter);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('with generators', () => {
    it('should work with generator functions', () => {
      function* gen() {
        yield 1;
        yield 2;
        yield 3;
      }

      const iter = new ExtendedIterable(gen());
      const result = iter.map((x) => x * 10).collect();

      expect(result).toEqual([10, 20, 30]);
    });
  });

  describe('with Map.entries', () => {
    it('should work with Map entries', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);

      const iter = new ExtendedIterable(map.entries());
      const result = iter.map(([key, val]) => `${key}=${val}`).join('&');

      expect(result).toBe('a=1&b=2');
    });
  });
});

describe('AsyncExtendedIterable', () => {
  describe('from sync iterable', () => {
    it('should convert sync array to async and collect', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const result = await iter.collect();

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('from async iterable', () => {
    it('should work with async generators', async () => {
      async function* gen() {
        yield 1;
        yield 2;
        yield 3;
      }

      const iter = new AsyncExtendedIterable(gen());
      const result = await iter.collect();

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('map', () => {
    it('should transform each element with sync function', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const result = await iter.map((x) => x * 2).collect();

      expect(result).toEqual([2, 4, 6]);
    });

    it('should transform each element with async function', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const result = await iter
        .map(async (x) => {
          await Promise.resolve(); // simulate async work
          return x * 2;
        })
        .collect();

      expect(result).toEqual([2, 4, 6]);
    });

    it('should be lazy - not evaluate until collected', async () => {
      let callCount = 0;
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const mapped = iter.map((x) => {
        callCount++;
        return x * 2;
      });

      expect(callCount).toBe(0);

      await mapped.collect();

      expect(callCount).toBe(3);
    });

    it('should allow chaining multiple maps', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const result = await iter
        .map((x) => x + 1)
        .map((x) => x * 2)
        .collect();

      expect(result).toEqual([4, 6, 8]);
    });
  });

  describe('filter', () => {
    it('should filter with sync predicate', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      const result = await iter.filter((x) => x % 2 === 0).collect();

      expect(result).toEqual([2, 4]);
    });

    it('should filter with async predicate', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      const result = await iter
        .filter(async (x) => {
          await Promise.resolve();
          return x > 2;
        })
        .collect();

      expect(result).toEqual([3, 4, 5]);
    });

    it('should chain map and filter', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      const result = await iter
        .map((x) => x * 2)
        .filter((x) => x > 4)
        .collect();

      expect(result).toEqual([6, 8, 10]);
    });
  });

  describe('join', () => {
    it('should join elements with separator', async () => {
      const iter = new AsyncExtendedIterable(['a', 'b', 'c']);

      const result = await iter.join(', ');

      expect(result).toBe('a, b, c');
    });

    it('should return empty string for empty iterable', async () => {
      const iter = new AsyncExtendedIterable<string>([]);

      const result = await iter.join(', ');

      expect(result).toBe('');
    });
  });

  describe('reduce', () => {
    it('should reduce with initial value', async () => {
      const result = await new AsyncExtendedIterable([1, 2, 3]).reduce(
        (sum, n) => sum + n,
        0
      );

      expect(result).toBe(6);
    });

    it('should reduce without initial value', async () => {
      const result = await new AsyncExtendedIterable([1, 2, 3]).reduce(
        (sum, n) => sum + n
      );

      expect(result).toBe(6);
    });

    it('should throw TypeError for empty iterable without initial value', async () => {
      await expect(
        new AsyncExtendedIterable<number>([]).reduce((sum, n) => sum + n)
      ).rejects.toThrow(TypeError);
    });

    it('should support async reducer function', async () => {
      const result = await new AsyncExtendedIterable([1, 2, 3]).reduce(
        async (sum, n) => sum + n,
        0
      );

      expect(result).toBe(6);
    });
  });

  describe('take', () => {
    it('should take first n elements', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      const result = await iter.take(3).collect();

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle taking more than available', async () => {
      const iter = new AsyncExtendedIterable([1, 2]);

      const result = await iter.take(5).collect();

      expect(result).toEqual([1, 2]);
    });

    it('should take zero elements', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      const result = await iter.take(0).collect();

      expect(result).toEqual([]);
    });

    it('should stop iteration early', async () => {
      let count = 0;
      async function* infiniteGen() {
        while (true) {
          count++;
          yield count;
        }
      }

      const iter = new AsyncExtendedIterable(infiniteGen());
      const result = await iter.take(3).collect();

      expect(result).toEqual([1, 2, 3]);
      // AsyncTakeIterator checks count before calling source.next(),
      // so it doesn't pull an extra element from the generator.
      expect(count).toEqual(3);
    });
  });

  describe('some', () => {
    it('should return true when predicate matches with sync function', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      expect(await iter.some((x) => x > 3)).toBe(true);
    });

    it('should return true when predicate matches with async function', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      expect(await iter.some(async (x) => x > 3)).toBe(true);
    });

    it('should return false when no elements match', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      expect(await iter.some((x) => x > 10)).toBe(false);
    });

    it('should short-circuit on first match', async () => {
      let callCount = 0;
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      await iter.some((x) => {
        callCount++;
        return x === 2;
      });

      expect(callCount).toBe(2);
    });

    it('should return false for empty iterable', async () => {
      const iter = new AsyncExtendedIterable<number>([]);

      expect(await iter.some((x) => x > 0)).toBe(false);
    });
  });

  describe('find', () => {
    it('should return first matching element with sync predicate', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      expect(await iter.find((x) => x > 2)).toBe(3);
    });

    it('should return first matching element with async predicate', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      expect(await iter.find(async (x) => x > 2)).toBe(3);
    });

    it('should return undefined when no match', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);

      expect(await iter.find((x) => x > 10)).toBeUndefined();
    });

    it('should short-circuit on first match', async () => {
      let callCount = 0;
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      await iter.find((x) => {
        callCount++;
        return x === 3;
      });

      expect(callCount).toBe(3);
    });

    it('should return undefined for empty iterable', async () => {
      const iter = new AsyncExtendedIterable<number>([]);

      expect(await iter.find((x) => x > 0)).toBeUndefined();
    });

    it('should work after chaining', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3, 4, 5]);

      const result = await iter.map((x) => x * 10).find((x) => x > 25);

      expect(result).toBe(30);
    });
  });

  describe('Symbol.asyncIterator', () => {
    it('should be async iterable with for-await-of', async () => {
      const iter = new AsyncExtendedIterable([1, 2, 3]);
      const result: number[] = [];

      for await (const val of iter) {
        result.push(val);
      }

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('real-world patterns', () => {
    it('should handle paginated API simulation', async () => {
      // Simulate fetching pages of data
      async function* fetchPages() {
        yield { page: 1, items: ['a', 'b'] };
        yield { page: 2, items: ['c', 'd'] };
        yield { page: 3, items: ['e'] };
      }

      const allItems = await new AsyncExtendedIterable(fetchPages())
        .map((page) => page.items)
        .collect();

      expect(allItems).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    });
  });

  describe('splice', () => {
    it('should splice async iterable', async () => {
      const { deleted, sliced } = await new AsyncExtendedIterable([
        1, 2, 3, 4, 5,
      ]).splice((el) => el === 3, 2, [10, 20]);

      const slicedRes = await sliced.collect();
      const deletedRes = await deleted.collect();

      expect(slicedRes).toEqual([1, 2, 10, 20, 5]);
      expect(deletedRes).toEqual([3, 4]);
    });

    it('should work with chained operations', async () => {
      const { sliced } = await new AsyncExtendedIterable([1, 2, 3, 4, 5])
        .map((x) => x * 2) // [2, 4, 6, 8, 10]
        .splice((x) => x === 6, 1, [99]); // Match 6, remove 6, insert 99

      // Result should be [2, 4, 99, 8, 10]
      expect(await sliced.collect()).toEqual([2, 4, 99, 8, 10]);
    });
  });
});
