import { TypeGuard } from './guards.js';

// Splice state and result types
interface SpliceState<T> {
  phase: 'seeking' | 'deleting' | 'inserting' | 'done';
  deletedCache: T[];
  slicedCache: T[];
  deletedPtr: number;
  slicedPtr: number;
  deleteRemaining: number;
  insertIterator: Iterator<T> | null;
  sourceIterator: Iterator<T>;
}

interface AsyncSpliceState<T> {
  phase: 'seeking' | 'deleting' | 'inserting' | 'done';
  deletedCache: T[];
  slicedCache: T[];
  deletedPtr: number;
  slicedPtr: number;
  deleteRemaining: number;
  insertIterator: AsyncIterator<T> | null;
  sourceIterator: AsyncIterator<T>;
}

interface SpliceResult<T> {
  sliced: Iterable<T>;
  deleted: Iterable<T>;
}

interface AsyncSpliceResult<T> {
  sliced: AsyncIterable<T>;
  deleted: AsyncIterable<T>;
}

type PipelineOp =
  | { type: 'map'; fn: (val: any) => any }
  | { type: 'filter'; fn: (val: any) => boolean }
  | { type: 'take'; n: number };

class PipelineIterator<T> implements Iterator<T>, Iterable<T> {
  private takeCounts: Map<number, number> = new Map();

  constructor(private source: Iterator<any>, private ops: PipelineOp[]) {
    // Initialize take counts
    this.ops.forEach((op, index) => {
      if (op.type === 'take') {
        this.takeCounts.set(index, 0);
      }
    });
  }

  next(): IteratorResult<T> {
    while (true) {
      let { done, value } = this.source.next();
      if (done) return { done: true, value: undefined };

      let dropped = false;
      for (let i = 0; i < this.ops.length; i++) {
        const op = this.ops[i];
        if (op.type === 'map') {
          value = op.fn(value);
        } else if (op.type === 'filter') {
          if (!op.fn(value)) {
            dropped = true;
            break;
          }
        } else if (op.type === 'take') {
          const count = this.takeCounts.get(i)!;
          if (count >= op.n) {
            dropped = true;
            // Ideally we'd signal done here, but for now we just drop
            // Optimization: If the *first* op is take and it's done, we can stop source
            // But if take is later in chain, we effectively just filter out the rest
            // To properly stop, we'd need to return done: true
            return { done: true, value: undefined };
          }
          this.takeCounts.set(i, count + 1);
        }
      }

      if (!dropped) {
        return { done: false, value };
      }
    }
  }

  [Symbol.iterator](): Iterator<T> {
    return this;
  }
}

/**
 * Creates a splice operation state and generators for sync iterables.
 * Returns both sliced (modified) and deleted element generators.
 */
function createSpliceGenerators<T>(
  source: Iterable<T>,
  matcher: (val: T) => boolean,
  deleteCount: number,
  insertIterable: Iterable<T>
): SpliceResult<T> {
  const state: SpliceState<T> = {
    phase: 'seeking',
    deletedCache: [],
    slicedCache: [],
    deletedPtr: 0,
    slicedPtr: 0,
    deleteRemaining: deleteCount,
    insertIterator: null,
    sourceIterator: source[Symbol.iterator](),
  };

  function* slicedGenerator(): Generator<T> {
    while (true) {
      // Yield from cache if available
      while (state.slicedPtr < state.slicedCache.length) {
        yield state.slicedCache[state.slicedPtr++];
      }

      // Process more elements from source
      if (state.phase === 'seeking') {
        const next = state.sourceIterator.next();
        if (next.done) {
          state.phase = 'done';
          return;
        }
        const val = next.value;
        if (matcher(val)) {
          state.phase = 'deleting';
          state.deletedCache.push(val);
          state.deleteRemaining--;
        } else {
          state.slicedCache.push(val);
          state.slicedPtr++;
          yield val;
        }
      } else if (state.phase === 'deleting') {
        if (state.deleteRemaining > 0) {
          const next = state.sourceIterator.next();
          if (next.done) {
            state.phase = 'done';
            return;
          }
          state.deletedCache.push(next.value);
          state.deleteRemaining--;
        } else {
          state.phase = 'inserting';
          state.insertIterator = insertIterable[Symbol.iterator]();
        }
      } else if (state.phase === 'inserting') {
        if (state.insertIterator === null) {
          state.insertIterator = insertIterable[Symbol.iterator]();
        }
        const next = state.insertIterator.next();
        if (next.done) {
          state.phase = 'done';
        } else {
          state.slicedCache.push(next.value);
          state.slicedPtr++;
          yield next.value;
        }
      } else if (state.phase === 'done') {
        const next = state.sourceIterator.next();
        if (next.done) {
          return;
        }
        state.slicedCache.push(next.value);
        state.slicedPtr++;
        yield next.value;
      }
    }
  }

  function* deletedGenerator(): Generator<T> {
    while (true) {
      // Yield from cache if available
      while (state.deletedPtr < state.deletedCache.length) {
        yield state.deletedCache[state.deletedPtr++];
      }

      // Need to advance sliced to fill deleted cache
      if (state.phase === 'seeking' || state.phase === 'deleting') {
        // Advance sliced generator to trigger processing
        const slicedIter = slicedGenerator();
        let result = slicedIter.next();
        while (!result.done && state.phase !== 'done') {
          result = slicedIter.next();
        }
      }

      // Check if we have more deleted items after processing
      if (state.deletedPtr >= state.deletedCache.length) {
        if (state.phase === 'done' || state.phase === 'inserting') {
          return;
        }
      }
    }
  }

  return {
    sliced: slicedGenerator(),
    deleted: deletedGenerator(),
  };
}

/**
 * Creates a splice operation state and generators for async iterables.
 * Returns both sliced (modified) and deleted element generators.
 */
async function createAsyncSpliceGenerators<T>(
  source: AsyncIterable<T>,
  matcher: (val: T) => boolean | Promise<boolean>,
  deleteCount: number,
  insertIterable: AsyncIterable<T>
): Promise<AsyncSpliceResult<T>> {
  const state: AsyncSpliceState<T> = {
    phase: 'seeking',
    deletedCache: [],
    slicedCache: [],
    deletedPtr: 0,
    slicedPtr: 0,
    deleteRemaining: deleteCount,
    insertIterator: null,
    sourceIterator: source[Symbol.asyncIterator](),
  };

  async function* slicedGenerator(): AsyncGenerator<T> {
    while (true) {
      // Yield from cache if available
      while (state.slicedPtr < state.slicedCache.length) {
        yield state.slicedCache[state.slicedPtr++];
      }

      // Process more elements from source
      if (state.phase === 'seeking') {
        const next = await state.sourceIterator.next();
        if (next.done) {
          state.phase = 'done';
          return;
        }
        const val = next.value;
        if (await matcher(val)) {
          state.phase = 'deleting';
          state.deletedCache.push(val);
          state.deleteRemaining--;
        } else {
          state.slicedCache.push(val);
          state.slicedPtr++;
          yield val;
        }
      } else if (state.phase === 'deleting') {
        if (state.deleteRemaining > 0) {
          const next = await state.sourceIterator.next();
          if (next.done) {
            state.phase = 'done';
            return;
          }
          state.deletedCache.push(next.value);
          state.deleteRemaining--;
        } else {
          state.phase = 'inserting';
          state.insertIterator = insertIterable[Symbol.asyncIterator]();
        }
      } else if (state.phase === 'inserting') {
        if (state.insertIterator === null) {
          state.insertIterator = insertIterable[Symbol.asyncIterator]();
        }
        const next = await state.insertIterator.next();
        if (next.done) {
          state.phase = 'done';
        } else {
          state.slicedCache.push(next.value);
          state.slicedPtr++;
          yield next.value;
        }
      } else if (state.phase === 'done') {
        const next = await state.sourceIterator.next();
        if (next.done) {
          return;
        }
        state.slicedCache.push(next.value);
        state.slicedPtr++;
        yield next.value;
      }
    }
  }

  async function* deletedGenerator(): AsyncGenerator<T> {
    while (true) {
      // Yield from cache if available
      while (state.deletedPtr < state.deletedCache.length) {
        yield state.deletedCache[state.deletedPtr++];
      }

      // Need to advance sliced to fill deleted cache
      if (state.phase === 'seeking' || state.phase === 'deleting') {
        // Advance sliced generator to trigger processing
        const slicedIter = slicedGenerator();
        let result = await slicedIter.next();
        while (!result.done && state.phase !== 'done') {
          result = await slicedIter.next();
        }
      }

      // Check if we have more deleted items after processing
      if (state.deletedPtr >= state.deletedCache.length) {
        if (state.phase === 'done' || state.phase === 'inserting') {
          return;
        }
      }
    }
  }

  return {
    sliced: slicedGenerator(),
    deleted: deletedGenerator(),
  };
}

/**
 * A wrapper around Iterable that provides chainable transformation methods.
 * Allows lazy evaluation of operations without converting to arrays.
 *
 * @example
 * ```typescript
 * const numbers = new ExtendedIterable([1, 2, 3]);
 * const doubled = numbers.map(x => x * 2).collect(); // [2, 4, 6]
 *
 * // Works with any iterable, including generators
 * const result = new ExtendedIterable(myGenerator())
 *   .map(transform)
 *   .join(', ');
 * ```
 */
export class ExtendedIterable<T> implements Iterable<T> {
  constructor(
    private iterable: Iterable<any>,
    private ops: PipelineOp[] = []
  ) {}

  /**
     * Flattens one level of nesting by yielding elements from nested iterables.

   * Non-iterable values are yielded as-is. Strings are not split into characters.
   *
   * @example
   * ```typescript
   * const nested = new ExtendedIterable([[1, 2], [3, 4]]);
   * const flat = nested.flat().collect(); // [1, 2, 3, 4]
   *
   * // Only flattens one level
   * const deep = new ExtendedIterable([[[1, 2]], [3]]);
   * deep.flat().collect(); // [[1, 2], 3]
   * ```
   */
  flat(): ExtendedIterable<T extends Iterable<infer U> ? U : T> {
    const source = this.iterable;
    function* flatGenerator(): Generator<T extends Iterable<infer U> ? U : T> {
      for (const value of source) {
        // Check if value is iterable (but not a string)
        if (
          value != null &&
          // Intentional design decision to not spread strings => characters
          // matching array.flat
          typeof value !== 'string' &&
          typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
        ) {
          yield* value as Iterable<T extends Iterable<infer U> ? U : T>;
        } else {
          yield value as T extends Iterable<infer U> ? U : T;
        }
      }
    }
    return new ExtendedIterable(flatGenerator());
  }

  /**
   * Maps each element through a transformation function.
   * Evaluation is lazy - the function is called only when iterating.
   */
  map<T2>(fn: (val: T) => T2): ExtendedIterable<T2> {
    return new ExtendedIterable(this.iterable, [
      ...this.ops,
      { type: 'map', fn },
    ]);
  }

  filter(predicate: (val: T) => boolean): ExtendedIterable<T>;
  filter<T2>(predicate: (val: T) => TypeGuard<T2>): ExtendedIterable<T2>;
  /**
   * Filters elements using a predicate function.
   * Supports type guards for narrowing.
   */
  filter<T2>(
    predicate: (val: T) => boolean | TypeGuard<T2>
  ): ExtendedIterable<T> | ExtendedIterable<T2> {
    return new ExtendedIterable(this.iterable, [
      ...this.ops,
      { type: 'filter', fn: predicate as (val: any) => boolean },
    ]);
  }

  /**
   * Takes the first n elements.
   */
  take(n: number): ExtendedIterable<T> {
    return new ExtendedIterable(this.iterable, [
      ...this.ops,
      { type: 'take', n },
    ]);
  }

  /**
   * Tests whether at least one element passes the predicate.
   * Short-circuits on first match.
   * Supports both sync and async predicates - returns Promise if predicate is async.
   */
  some(predicate: (val: T) => boolean): boolean;
  some(predicate: (val: T) => Promise<boolean>): Promise<boolean>;
  some(
    predicate: (val: T) => boolean | Promise<boolean>
  ): boolean | Promise<boolean> {
    const iterator = this[Symbol.iterator]();

    const processAsync = async (
      pending: Promise<boolean>
    ): Promise<boolean> => {
      if (await pending) return true;
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        if (await predicate(next.value)) return true;
      }
      return false;
    };

    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      const result = predicate(next.value);
      if (result instanceof Promise) {
        return processAsync(result);
      }
      if (result) return true;
    }
    return false;
  }

  /**
   * Returns the first element that passes the predicate, or undefined.
   * Short-circuits on first match.
   * Supports both sync and async predicates - returns Promise if predicate is async.
   */
  find(predicate: (val: T) => boolean): T | undefined;
  find(predicate: (val: T) => Promise<boolean>): Promise<T | undefined>;
  find(
    predicate: (val: T) => boolean | Promise<boolean>
  ): T | undefined | Promise<T | undefined> {
    const iterator = this[Symbol.iterator]();

    const processAsync = async (
      currentVal: T,
      pending: Promise<boolean>
    ): Promise<T | undefined> => {
      if (await pending) return currentVal;
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        if (await predicate(next.value)) return next.value;
      }
      return undefined;
    };

    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      const result = predicate(next.value);
      if (result instanceof Promise) {
        return processAsync(next.value, result);
      }
      if (result) return next.value;
    }
    return undefined;
  }

  /**
   * Collects all elements into an array.
   */
  collect(): T[] {
    const arr: T[] = [];
    for (const val of this) {
      arr.push(val);
    }
    return arr;
  }

  /**
   * Joins all elements into a string with a separator.
   * Elements are converted to strings using toString().
   */
  join(separator: string): string {
    let str = '';
    const iterator = this[Symbol.iterator]();
    let next = iterator.next();
    while (!next.done) {
      str += String(next.value);
      next = iterator.next();
      if (!next.done) {
        str += separator;
      }
    }
    return str;
  }

  /**
   * Flattens one level of nesting by yielding elements from nested iterables.
   * Non-iterable values are yielded as-is. Strings are not split into characters.
   *
   * @example
   * ```typescript
   * const nested = new ExtendedIterable([[1, 2], [3, 4]]);
   * const flat = nested.flat().collect(); // [1, 2, 3, 4]
   *
   * // Only flattens one level
   * const deep = new ExtendedIterable([[[1, 2]], [3]]);
   * deep.flat().collect(); // [[1, 2], 3]
   * ```
   */
  flat(): ExtendedIterable<T extends Iterable<infer U> ? U : T> {
    const source = this;
    function* flatGenerator(): Generator<T extends Iterable<infer U> ? U : T> {
      for (const value of source) {
        // Check if value is iterable (but not a string)
        if (
          value != null &&
          // Intentional design decision to not spread strings => characters
          // matching array.flat
          typeof value !== 'string' &&
          typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
        ) {
          yield* value as Iterable<T extends Iterable<infer U> ? U : T>;
        } else {
          yield value as T extends Iterable<infer U> ? U : T;
        }
      }
    }
    return new ExtendedIterable(flatGenerator());
  }

  /**
   * Removes elements from the iterable and optionally inserts new elements.
   * Returns both the modified iterable and the deleted elements.
   * Both iterables share state - iterating either will cache results for the other.
   *
   * @param matcher - Predicate to find the splice position
   * @param deleteCount - Number of elements to remove after the match
   * @param insertIterable - Elements to insert after removing
   * @returns Object with `sliced` (modified iterable) and `deleted` (removed elements)
   *
   * @example
   * ```typescript
   * const { deleted, sliced } = iter([1, 2, 3, 4, 5])
   *   .splice((el) => el === 3, 2, iter([10, 20]));
   * sliced.collect();  // [1, 2, 10, 20, 5]
   * deleted.collect(); // [3, 4]
   * ```
   */

  splice(
    matcher: (val: T) => boolean,
    deleteCount: number,
    insertIterable: Iterable<T>
  ): { deleted: ExtendedIterable<T>; sliced: ExtendedIterable<T> } {
    const { sliced, deleted } = createSpliceGenerators(
      this.iterable,
      matcher,
      deleteCount,
      insertIterable
    );

    return {
      sliced: new ExtendedIterable(sliced),
      deleted: new ExtendedIterable(deleted),
    };
  }

  [Symbol.iterator](): Iterator<T> {
    if (this.ops.length > 0) {
      return new PipelineIterator(this.iterable[Symbol.iterator](), this.ops);
    }
    return this.iterable[Symbol.iterator]();
  }
}

export class AsyncExtendedIterable<T> implements AsyncIterable<T> {
  private asyncIterable: AsyncIterable<T>;

  constructor(iterable: AsyncIterable<T> | Iterable<T>) {
    // Convert sync iterables to async
    if (Symbol.asyncIterator in iterable) {
      this.asyncIterable = iterable as AsyncIterable<T>;
    } else {
      const syncIterable = iterable as Iterable<T>;
      this.asyncIterable = {
        async *[Symbol.asyncIterator]() {
          for (const val of syncIterable) {
            yield val;
          }
        },
      };
    }
  }

  /**
   * Maps each element through a transformation function.
   * The function can be sync or async.
   * Evaluation is lazy - the function is called only when iterating.
   */
  map<T2>(fn: (val: T) => T2 | Promise<T2>): AsyncExtendedIterable<T2> {
    const source = this.asyncIterable;
    const asyncGen: AsyncIterable<T2> = {
      async *[Symbol.asyncIterator]() {
        for await (const val of source) {
          yield await fn(val);
        }
      },
    };
    return new AsyncExtendedIterable(asyncGen);
  }

  filter(
    predicate: (val: T) => boolean | Promise<boolean>
  ): AsyncExtendedIterable<T>;
  filter<T2 = unknown>(
    predicate: (val: T) => TypeGuard<T2>
  ): AsyncExtendedIterable<T2>;
  /**
   * Filters elements using a predicate function.
   * The predicate can be sync or async.
   */
  filter<T2 = unknown>(
    predicate: (val: T) => boolean | Promise<boolean> | TypeGuard<T2>
  ): AsyncExtendedIterable<T> | AsyncExtendedIterable<T2> {
    const source = this.asyncIterable;
    const asyncGen: AsyncIterable<T> = {
      async *[Symbol.asyncIterator]() {
        for await (const val of source) {
          if (await predicate(val)) {
            yield val;
          }
        }
      },
    };
    return new AsyncExtendedIterable(asyncGen);
  }

  /**
   * Collects all elements into an array.
   */
  async collect(): Promise<T[]> {
    const arr: T[] = [];
    for await (const val of this.asyncIterable) {
      arr.push(val);
    }
    return arr;
  }

  /**
   * Joins all elements into a string with a separator.
   * Elements are converted to strings using String().
   */
  async join(separator: string): Promise<string> {
    const arr = await this.collect();
    return arr.map(String).join(separator);
  }

  /**
   * Takes the first n elements.
   */
  take(n: number): AsyncExtendedIterable<T> {
    const source = this.asyncIterable;
    const asyncGen: AsyncIterable<T> = {
      async *[Symbol.asyncIterator]() {
        let count = 0;
        for await (const val of source) {
          if (count >= n) break;
          yield val;
          count++;
        }
      },
    };
    return new AsyncExtendedIterable(asyncGen);
  }

  /**
   * Tests whether at least one element passes the predicate.
   * Short-circuits on first match. Predicate can be sync or async.
   */
  async some(
    predicate: (val: T) => boolean | Promise<boolean>
  ): Promise<boolean> {
    for await (const val of this.asyncIterable) {
      if (await predicate(val)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the first element that passes the predicate, or undefined.
   * Short-circuits on first match. Predicate can be sync or async.
   */
  async find(
    predicate: (val: T) => boolean | Promise<boolean>
  ): Promise<T | undefined> {
    for await (const val of this.asyncIterable) {
      if (await predicate(val)) {
        return val;
      }
    }
    return undefined;
  }

  /**
   * Removes elements from the async iterable and optionally inserts new elements.
   * Returns both the modified iterable and the deleted elements.
   * Both iterables share state - iterating either will cache results for the other.
   *
   * @param matcher - Predicate to find the splice position (can be async)
   * @param deleteCount - Number of elements to remove after the match
   * @param insertIterable - Elements to insert after removing
   * @returns Object with `sliced` (modified iterable) and `deleted` (removed elements)
   */
  async splice(
    matcher: (val: T) => boolean | Promise<boolean>,
    deleteCount: number,
    insertIterable: AsyncIterable<T> | Iterable<T>
  ): Promise<{
    deleted: AsyncExtendedIterable<T>;
    sliced: AsyncExtendedIterable<T>;
  }> {
    // Convert insert iterable to async if needed
    const asyncInsert: AsyncIterable<T> =
      Symbol.asyncIterator in insertIterable
        ? (insertIterable as AsyncIterable<T>)
        : {
            async *[Symbol.asyncIterator]() {
              for (const val of insertIterable as Iterable<T>) {
                yield val;
              }
            },
          };

    const { sliced, deleted } = await createAsyncSpliceGenerators(
      this.asyncIterable,
      matcher,
      deleteCount,
      asyncInsert
    );

    return {
      sliced: new AsyncExtendedIterable(sliced),
      deleted: new AsyncExtendedIterable(deleted),
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.asyncIterable[Symbol.asyncIterator]();
  }
}

/**
 * Helper to create an AsyncExtendedIterable from any iterable.
 */
export function asyncIter<T>(iterable: AsyncIterable<T> | Iterable<T>) {
  return new AsyncExtendedIterable(iterable);
}

/**
 * Returns an AsyncExtendedIterable that yields promise results as they settle,
 * in completion order (not input order).
 *
 * Like Promise.allSettled, but streaming - you get results as soon as they're ready,
 * with full chaining support.
 *
 * @example
 * ```typescript
 * const promises = [
 *   fetch('/slow'),   // takes 3s
 *   fetch('/fast'),   // takes 1s
 *   fetch('/medium'), // takes 2s
 * ];
 *
 * // Results arrive in order: fast, medium, slow
 * for await (const result of asSettled(promises)) {
 *   if (result.status === 'fulfilled') {
 *     console.log('Got:', result.value);
 *   } else {
 *     console.log('Failed:', result.reason);
 *   }
 * }
 *
 * // Chain operations
 * const firstThreeSuccesses = await asSettled(promises)
 *   .filter(r => r.status === 'fulfilled')
 *   .map(r => (r as PromiseFulfilledResult<Response>).value)
 *   .take(3)
 *   .collect();
 * ```
 */
export function asSettled<T>(
  promises: Iterable<Promise<T>>
): AsyncExtendedIterable<PromiseSettledResult<T>> {
  return new AsyncExtendedIterable(asSettledGen(promises));
}

/**
 * Internal generator for asSettled.
 */
async function* asSettledGen<T>(
  promises: Iterable<Promise<T>>
): AsyncGenerator<PromiseSettledResult<T>> {
  const queue: PromiseSettledResult<T>[] = [];
  let notifyReady: (() => void) | null = null;
  let remaining = 0;

  // Wire up each promise to push to queue when it settles
  for (const p of promises) {
    remaining++;
    Promise.resolve(p).then(
      (value) => {
        queue.push({ status: 'fulfilled', value });
        notifyReady?.();
      },
      (reason) => {
        queue.push({ status: 'rejected', reason });
        notifyReady?.();
      }
    );
  }

  // Yield results as they arrive
  while (remaining > 0) {
    if (queue.length === 0) {
      // Wait for something to settle
      await new Promise<void>((resolve) => {
        notifyReady = resolve;
      });
      notifyReady = null;
    }

    // Drain everything currently in queue
    while (queue.length > 0 && remaining > 0) {
      yield queue.shift();
      remaining--;
    }
  }
}

/**
 * Helper to create an ExtendedIterable from any iterable.
 */
export function iter<T>(iterable: Iterable<T>) {
  return new ExtendedIterable(iterable);
}
