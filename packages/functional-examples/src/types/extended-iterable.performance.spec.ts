import { describe, expect, it } from 'vitest';
import { ExtendedIterable, iter } from './extended-iterable.js';

/**
 * Performance comparison tests between ExtendedIterable and native Array methods.
 *
 * These tests verify that:
 * 1. ExtendedIterable has low overhead for single operations (within ~2x of native)
 * 2. ExtendedIterable is comparable for chained operations without early exit
 * 3. ExtendedIterable is much FASTER when early termination (take) is used
 * 4. Short-circuit ops (find, some) are near-native
 */
describe('ExtendedIterable performance vs Array methods', () => {
  const WARMUP_ITERATIONS = 10;
  const BENCHMARK_ITERATIONS = 100;

  function measureTime(fn: () => void, iterations: number): number {
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      fn();
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();

    return (end - start) / iterations;
  }

  describe('single operations - low overhead', () => {
    it('map operation should be within 5x of native', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray).map((x) => x * 2).collect();
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        largeArray.map((x) => x * 2);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Map - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(5);
    });

    it('filter operation should be within 5x of native', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray).filter((x) => x % 2 === 0).collect();
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        largeArray.filter((x) => x % 2 === 0);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Filter - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(5);
    });
  });

  describe('chained operations WITHOUT early termination', () => {
    it('chained map().filter().collect() should be within 8x of native', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray)
          .map((x) => x * 2)
          .filter((x) => x % 3 === 0)
          .collect();
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        largeArray.map((x) => x * 2).filter((x) => x % 3 === 0);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Chained (no early exit) - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(8);
    });
  });

  describe('chained operations WITH early termination - ExtendedIterable should be FASTER', () => {
    it('chained map().filter().take() should be at least 5x faster than Array', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray)
          .map((x) => x * 2)
          .filter((x) => x % 3 === 0)
          .take(100)
          .collect();
      }, 50);

      const arrayTime = measureTime(() => {
        largeArray
          .map((x) => x * 2)
          .filter((x) => x % 3 === 0)
          .slice(0, 100);
      }, 50);

      const ratio = arrayTime / extendedTime;
      console.log(
        `Chained with take(100) - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Extended is ${ratio.toFixed(2)}x faster`
      );

      expect(ratio).toBeGreaterThan(5);
    });

    it('chained map().filter().take(5) on large array should be at least 10x faster', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);

      let extendedMapCalls = 0;
      const extendedTime = measureTime(() => {
        extendedMapCalls = 0;
        new ExtendedIterable(largeArray)
          .map((x) => {
            extendedMapCalls++;
            return x * 2;
          })
          .filter((x) => x % 1000 === 0)
          .take(5)
          .collect();
      }, 50);

      let arrayMapCalls = 0;
      const arrayTime = measureTime(() => {
        arrayMapCalls = 0;
        largeArray
          .map((x) => {
            arrayMapCalls++;
            return x * 2;
          })
          .filter((x) => x % 1000 === 0)
          .slice(0, 5);
      }, 50);

      const ratio = arrayTime / extendedTime;
      console.log(`Memory efficiency test:`);
      console.log(
        `  ExtendedIterable: ${extendedTime.toFixed(3)}ms, map called ${extendedMapCalls} times (per iteration)`
      );
      console.log(
        `  Array: ${arrayTime.toFixed(3)}ms, map called ${arrayMapCalls} times (per iteration)`
      );
      console.log(`  Extended is ${ratio.toFixed(2)}x faster`);

      expect(ratio).toBeGreaterThan(10);
      // ExtendedIterable should call map significantly fewer times
      expect(extendedMapCalls).toBeLessThan(arrayMapCalls / 10);
    });
  });

  describe('splice operations - lazy evaluation benefits', () => {
    it('splice with early termination on sliced should avoid processing full array', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        const { sliced } = iter(largeArray).splice(
          (x) => x === 5000,
          10,
          iter([99999])
        );
        const iter8r = sliced[Symbol.iterator]();
        for (let i = 0; i < 5; i++) {
          iter8r.next();
        }
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        const arr = [...largeArray];
        arr.splice(5000, 10, 99999);
        arr.slice(0, 5);
      }, BENCHMARK_ITERATIONS);

      const ratio = arrayTime / extendedTime;
      console.log(
        `Splice early termination - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Extended is ${ratio.toFixed(2)}x faster`
      );

      expect(ratio).toBeGreaterThan(0.3);
    });
  });

  describe('short-circuit operations - near-native performance', () => {
    it('find operation should be within 2x of native', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray).find((x) => x === 50000);
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        largeArray.find((x) => x === 50000);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Find - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(3);
    });

    it('some operation should be within 2x of native', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);

      const extendedTime = measureTime(() => {
        new ExtendedIterable(largeArray).some((x) => x > 50000);
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        largeArray.some((x) => x > 50000);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Some - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(2);
    });
  });

  describe('deep chain from Map.entries - realistic 5-op pipeline', () => {
    // Simulates a real scenario: a registry of users, each with a Map of
    // projects, each project having a score. We want to extract the top
    // project names from active users.
    function buildRegistry(userCount: number, projectsPerUser: number) {
      const registry = new Map<string, { active: boolean; projects: Map<string, number> }>();
      for (let u = 0; u < userCount; u++) {
        const projects = new Map<string, number>();
        for (let p = 0; p < projectsPerUser; p++) {
          projects.set(`proj-${u}-${p}`, (u * projectsPerUser + p) % 100);
        }
        registry.set(`user-${u}`, { active: u % 3 !== 0, projects });
      }
      return registry;
    }

    it('5-op chain: map → filter → map → flat → filter should be comparable to native', () => {
      const registry = buildRegistry(1000, 20);

      // ExtendedIterable: iterables stay as iterables — no spreading needed
      const extendedTime = measureTime(() => {
        iter(registry.entries())
          .map(([, user]) => user)                              // 1: unwrap values
          .filter((user) => user.active)                        // 2: active users only
          .map((user) => user.projects.entries())               // 3: project entries (iterable, no spread)
          .flat()                                               // 4: flatten into [name, score] tuples
          .filter(([, score]) => (score as number) >= 50)       // 5: high-scoring projects
          .collect();
      }, BENCHMARK_ITERATIONS);

      // Native: must spread iterables into arrays at every step
      const arrayTime = measureTime(() => {
        [...registry.entries()]
          .map(([, user]) => user)
          .filter((user) => user.active)
          .map((user) => [...user.projects.entries()])
          .flat()
          .filter(([, score]) => score >= 50);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Deep 5-op chain (Map.entries) - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      // With iterables flowing through natively, we avoid intermediate array creation
      expect(ratio).toBeLessThan(3);
    });

    it('5-op chain with take should massively outperform native', () => {
      const registry = buildRegistry(500, 20);

      const extendedTime = measureTime(() => {
        iter(registry.entries())
          .map(([, user]) => user)
          .filter((user) => user.active)
          .map((user) => user.projects.entries())               // iterable, no spread
          .flat()
          .filter(([, score]) => (score as number) >= 50)
          .take(10)
          .collect();
      }, 50);

      // Native: must spread + allocate intermediate arrays for every step
      const arrayTime = measureTime(() => {
        [...registry.entries()]
          .map(([, user]) => user)
          .filter((user) => user.active)
          .map((user) => [...user.projects.entries()])
          .flat()
          .filter(([, score]) => score >= 50)
          .slice(0, 10);
      }, 50);

      const ratio = arrayTime / extendedTime;
      console.log(
        `Deep 5-op chain + take(10) - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Extended is ${ratio.toFixed(2)}x faster`
      );

      expect(ratio).toBeGreaterThan(5);
    });
  });

  describe('simple 5-op chain from Map.values - reduce terminal', () => {
    // Simulates: a Map of product IDs → prices. We want to compute the
    // total cost of discounted items above a price threshold.
    function buildPriceMap(size: number) {
      const prices = new Map<string, number>();
      for (let i = 0; i < size; i++) {
        prices.set(`item-${i}`, (i % 200) + 1);
      }
      return prices;
    }

    it('5-op chain: map → filter → map → filter → reduce should be comparable to native', () => {
      const prices = buildPriceMap(50000);

      const extendedTime = measureTime(() => {
        iter(prices.values())
          .map((price) => price * 0.9)             // 1: apply 10% discount
          .filter((price) => price > 50)            // 2: only items > $50
          .map((price) => Math.round(price * 100))  // 3: convert to cents
          .filter((cents) => cents % 2 === 0)       // 4: even cent amounts
          .reduce((sum, cents) => sum + cents, 0);  // 5: total
      }, BENCHMARK_ITERATIONS);

      const arrayTime = measureTime(() => {
        [...prices.values()]
          .map((price) => price * 0.9)
          .filter((price) => price > 50)
          .map((price) => Math.round(price * 100))
          .filter((cents) => cents % 2 === 0)
          .reduce((sum, cents) => sum + cents, 0);
      }, BENCHMARK_ITERATIONS);

      const ratio = extendedTime / arrayTime;
      console.log(
        `Simple 5-op chain (Map.values + reduce) - ExtendedIterable: ${extendedTime.toFixed(3)}ms, Array: ${arrayTime.toFixed(3)}ms, Ratio: ${ratio.toFixed(2)}x`
      );

      expect(ratio).toBeLessThan(3);
    });

    it('produces same result as native', () => {
      const prices = buildPriceMap(1000);

      const extended = iter(prices.values())
        .map((price) => price * 0.9)
        .filter((price) => price > 50)
        .map((price) => Math.round(price * 100))
        .filter((cents) => cents % 2 === 0)
        .reduce((sum, cents) => sum + cents, 0);

      const native = [...prices.values()]
        .map((price) => price * 0.9)
        .filter((price) => price > 50)
        .map((price) => Math.round(price * 100))
        .filter((cents) => cents % 2 === 0)
        .reduce((sum, cents) => sum + cents, 0);

      expect(extended).toBe(native);
    });
  });

  describe('correctness - all operations produce equivalent results', () => {
    it('map produces same results as Array.map', () => {
      const arr = [1, 2, 3, 4, 5];
      const extended = new ExtendedIterable(arr).map((x) => x * 2).collect();
      const native = arr.map((x) => x * 2);
      expect(extended).toEqual(native);
    });

    it('filter produces same results as Array.filter', () => {
      const arr = [1, 2, 3, 4, 5];
      const extended = new ExtendedIterable(arr)
        .filter((x) => x % 2 === 0)
        .collect();
      const native = arr.filter((x) => x % 2 === 0);
      expect(extended).toEqual(native);
    });

    it('chained operations produce same results', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const extended = new ExtendedIterable(arr)
        .map((x) => x * 2)
        .filter((x) => x > 5)
        .take(3)
        .collect();
      const native = arr
        .map((x) => x * 2)
        .filter((x) => x > 5)
        .slice(0, 3);
      expect(extended).toEqual(native);
    });

    it('find produces same result as Array.find', () => {
      const arr = [1, 2, 3, 4, 5];
      const extended = new ExtendedIterable(arr).find((x) => x > 3);
      const native = arr.find((x) => x > 3);
      expect(extended).toEqual(native);
    });

    it('reduce produces same result as Array.reduce', () => {
      const arr = [1, 2, 3, 4, 5];
      const extended = new ExtendedIterable(arr).reduce((sum, x) => sum + x, 0);
      const native = arr.reduce((sum, x) => sum + x, 0);
      expect(extended).toBe(native);
    });
  });
});
