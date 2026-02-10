import { TypeGuard } from './guards.js';

// Shared done sentinel to reduce allocations
const DONE: IteratorResult<never> = { done: true, value: undefined as never };

// --- Sync iterator classes ---
// Classes give V8 stable hidden classes and monomorphic inline caches on next(),
// which outperforms plain object factories on chained operations.

class MapIterator<T, U> implements Iterator<U> {
  private r: IteratorResult<U> = { done: false, value: undefined as U };
  constructor(
    private source: Iterator<T>,
    private fn: (val: T) => U
  ) {}
  next(): IteratorResult<U> {
    const result = this.source.next();
    if (result.done) return DONE;
    this.r.value = this.fn(result.value);
    return this.r;
  }
  [Symbol.iterator]() {
    return this;
  }
}

class FilterIterator<T> implements Iterator<T> {
  private r: IteratorResult<T> = { done: false, value: undefined as T };
  constructor(
    private source: Iterator<T>,
    private fn: (val: T) => boolean
  ) {}
  next(): IteratorResult<T> {
    while (true) {
      const result = this.source.next();
      if (result.done) return DONE;
      if (this.fn(result.value)) {
        this.r.value = result.value;
        return this.r;
      }
    }
  }
  [Symbol.iterator]() {
    return this;
  }
}

class TakeIterator<T> implements Iterator<T> {
  private r: IteratorResult<T> = { done: false, value: undefined as T };
  private count = 0;
  constructor(
    private source: Iterator<T>,
    private n: number
  ) {}
  next(): IteratorResult<T> {
    if (this.count >= this.n) return DONE;
    const result = this.source.next();
    if (result.done) return DONE;
    this.count++;
    this.r.value = result.value;
    return this.r;
  }
  [Symbol.iterator]() {
    return this;
  }
}

class FlatIterator<T> implements Iterator<T> {
  private r: IteratorResult<T> = { done: false, value: undefined as T };
  private inner: Iterator<T> | null = null;
  constructor(private source: Iterator<unknown>) {}
  next(): IteratorResult<T> {
    while (true) {
      if (this.inner) {
        const result = this.inner.next();
        if (!result.done) {
          this.r.value = result.value;
          return this.r;
        }
        this.inner = null;
      }

      const result = this.source.next();
      if (result.done) return DONE;

      const value = result.value;
      if (
        value != null &&
        typeof value !== 'string' &&
        typeof (value as Iterable<T>)[Symbol.iterator] === 'function'
      ) {
        this.inner = (value as Iterable<T>)[Symbol.iterator]();
      } else {
        this.r.value = value as T;
        return this.r;
      }
    }
  }
  [Symbol.iterator]() {
    return this;
  }
}

class PrefixIterator<T> implements Iterator<T> {
  private prefixIt: Iterator<T> | null;
  constructor(
    prefix: Iterable<T>,
    private source: Iterator<T>
  ) {
    this.prefixIt = prefix[Symbol.iterator]();
  }
  next(): IteratorResult<T> {
    if (this.prefixIt) {
      const result = this.prefixIt.next();
      if (!result.done) return result;
      this.prefixIt = null;
    }
    return this.source.next();
  }
  [Symbol.iterator]() {
    return this;
  }
}

// --- Async iterator classes ---

class AsyncMapIterator<T, U> implements AsyncIterator<U> {
  constructor(
    private source: AsyncIterator<T>,
    private fn: (val: T) => U | Promise<U>
  ) {}
  async next(): Promise<IteratorResult<U>> {
    const result = await this.source.next();
    if (result.done) return DONE;
    return { done: false, value: await this.fn(result.value) };
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}

class AsyncFilterIterator<T> implements AsyncIterator<T> {
  constructor(
    private source: AsyncIterator<T>,
    private fn: (val: T) => boolean | Promise<boolean>
  ) {}
  async next(): Promise<IteratorResult<T>> {
    while (true) {
      const result = await this.source.next();
      if (result.done) return DONE;
      if (await this.fn(result.value))
        return { done: false, value: result.value };
    }
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}

class AsyncTakeIterator<T> implements AsyncIterator<T> {
  private count = 0;
  constructor(
    private source: AsyncIterator<T>,
    private n: number
  ) {}
  async next(): Promise<IteratorResult<T>> {
    if (this.count >= this.n) return DONE;
    const result = await this.source.next();
    if (result.done) return DONE;
    this.count++;
    return result;
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}

// --- Splice support ---

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
      while (state.slicedPtr < state.slicedCache.length) {
        yield state.slicedCache[state.slicedPtr++];
      }

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
        if (next.done) return;
        state.slicedCache.push(next.value);
        state.slicedPtr++;
        yield next.value;
      }
    }
  }

  function* deletedGenerator(): Generator<T> {
    while (true) {
      while (state.deletedPtr < state.deletedCache.length) {
        yield state.deletedCache[state.deletedPtr++];
      }

      if (state.phase === 'seeking' || state.phase === 'deleting') {
        const slicedIter = slicedGenerator();
        let result = slicedIter.next();
        // slicedGenerator mutates state.phase as it iterates, so re-read
        // through the full type to avoid TS narrowing from the outer `if`.
        while (!result.done && (state as SpliceState<T>).phase !== 'done') {
          result = slicedIter.next();
        }
      }

      if (state.deletedPtr >= state.deletedCache.length) {
        if (state.phase === 'done' || state.phase === 'inserting') return;
      }
    }
  }

  return {
    sliced: slicedGenerator(),
    deleted: deletedGenerator(),
  };
}

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
      while (state.slicedPtr < state.slicedCache.length) {
        yield state.slicedCache[state.slicedPtr++];
      }

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
        if (next.done) return;
        state.slicedCache.push(next.value);
        state.slicedPtr++;
        yield next.value;
      }
    }
  }

  async function* deletedGenerator(): AsyncGenerator<T> {
    while (true) {
      while (state.deletedPtr < state.deletedCache.length) {
        yield state.deletedCache[state.deletedPtr++];
      }

      if (state.phase === 'seeking' || state.phase === 'deleting') {
        const slicedIter = slicedGenerator();
        let result = await slicedIter.next();
        // slicedGenerator mutates state.phase as it iterates, so re-read
        // through the full type to avoid TS narrowing from the outer `if`.
        while (
          !result.done &&
          (state as AsyncSpliceState<T>).phase !== 'done'
        ) {
          result = await slicedIter.next();
        }
      }

      if (state.deletedPtr >= state.deletedCache.length) {
        if (state.phase === 'done' || state.phase === 'inserting') return;
      }
    }
  }

  return {
    sliced: slicedGenerator(),
    deleted: deletedGenerator(),
  };
}

function asyncIterableFrom<T>(
  factory: () => AsyncIterator<T>
): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: factory };
}

/**
 * A wrapper around Iterable that provides chainable transformation methods.
 * Each method returns a new ExtendedIterable wrapping the source,
 * mirroring how Array methods work but with lazy evaluation.
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
  private _iterFn: () => Iterator<T>;

  constructor(iterable: Iterable<T>) {
    // Store a factory so we can create fresh iterators on each iteration.
    // For iterables that are already single-use (generators), this preserves
    // the existing behavior — iterating twice just yields nothing the second time.
    this._iterFn = () => iterable[Symbol.iterator]();
  }

  // Internal: create from a factory directly, skipping the iterable wrapper
  private static _from<T>(factory: () => Iterator<T>): ExtendedIterable<T> {
    const inst = Object.create(ExtendedIterable.prototype) as ExtendedIterable<T>;
    inst._iterFn = factory;
    return inst;
  }

  /**
   * Flattens one level of nesting by yielding elements from nested iterables.
   * Non-iterable values are yielded as-is. Strings are not split into characters.
   */
  flat(): ExtendedIterable<T extends Iterable<infer U> ? U : T> {
    type Out = T extends Iterable<infer U> ? U : T;
    const parentIter = this._iterFn;
    return ExtendedIterable._from<Out>(
      () => new FlatIterator<Out>(parentIter() as Iterator<unknown>)
    );
  }

  /**
   * Maps each element through a transformation function.
   * Evaluation is lazy - the function is called only when iterating.
   */
  map<T2>(fn: (val: T) => T2): ExtendedIterable<T2> {
    const parentIter = this._iterFn;
    return ExtendedIterable._from<T2>(() => new MapIterator(parentIter(), fn));
  }

  filter(predicate: (val: T) => boolean): ExtendedIterable<T>;
  filter<T2>(predicate: (val: T) => TypeGuard<T2>): ExtendedIterable<T2>;
  /**
   * Filters elements using a predicate function.
   * Supports type guards for narrowing.
   */
  filter<T2 = unknown>(
    predicate: (val: T) => boolean | TypeGuard<T2>
  ): ExtendedIterable<T> | ExtendedIterable<T2> {
    const parentIter = this._iterFn;
    return ExtendedIterable._from<T>(
      () =>
        new FilterIterator(parentIter(), predicate as (val: T) => boolean)
    ) as ExtendedIterable<T> | ExtendedIterable<T2>;
  }

  /**
   * Takes the first n elements.
   */
  take(n: number): ExtendedIterable<T> {
    const parentIter = this._iterFn;
    return ExtendedIterable._from<T>(() => new TakeIterator(parentIter(), n));
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
   * Reduces the iterable to a single value by applying a function against
   * an accumulator and each element.
   *
   * Without an initial value, the first element is used as the accumulator
   * and reduction starts from the second element. Throws TypeError on empty iterables.
   *
   * @example
   * ```typescript
   * iter([1, 2, 3]).reduce((sum, n) => sum + n);        // 6
   * iter([1, 2, 3]).reduce((sum, n) => sum + n, 10);    // 16
   * ```
   */
  reduce(fn: (acc: T, val: T) => T): T;
  reduce<U>(fn: (acc: U, val: T) => U, initialValue: U): U;
  reduce<U>(
    fn: (acc: T | U, val: T) => T | U,
    ...rest: [] | [U]
  ): T | U {
    const it = this[Symbol.iterator]();
    let acc: T | U;
    if (rest.length > 0) {
      acc = rest[0];
    } else {
      const first = it.next();
      if (first.done) {
        throw new TypeError('Reduce of empty iterable with no initial value');
      }
      acc = first.value;
    }
    for (let r = it.next(); !r.done; r = it.next()) {
      acc = fn(acc, r.value);
    }
    return acc;
  }

  /**
   * Collects all elements into an array.
   */
  collect(): T[] {
    const arr: T[] = [];
    const it = this[Symbol.iterator]();
    for (let r = it.next(); !r.done; r = it.next()) {
      arr.push(r.value);
    }
    return arr;
  }

  /**
   * Joins all elements into a string with a separator.
   * Elements are converted to strings using toString().
   */
  join(separator: string): string {
    const it = this[Symbol.iterator]();
    let r = it.next();
    if (r.done) return '';
    let str = String(r.value);
    for (r = it.next(); !r.done; r = it.next()) {
      str += separator + String(r.value);
    }
    return str;
  }

  /**
   * Prepends an iterable to the start of this iterable.
   */
  prefix<U>(prefix: Iterable<U>): ExtendedIterable<T | U> {
    const parentIter = this._iterFn;
    return ExtendedIterable._from<T | U>(
      () => new PrefixIterator<T | U>(prefix, parentIter() as Iterator<T | U>)
    );
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
      this,
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
    return this._iterFn();
  }
}

export class AsyncExtendedIterable<T> implements AsyncIterable<T> {
  private asyncIterable: AsyncIterable<T>;

  constructor(iterable: AsyncIterable<T> | Iterable<T>) {
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
    return new AsyncExtendedIterable<T2>(
      asyncIterableFrom(() =>
        new AsyncMapIterator(source[Symbol.asyncIterator](), fn)
      )
    );
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
    return new AsyncExtendedIterable<T>(
      asyncIterableFrom(() =>
        new AsyncFilterIterator(
          source[Symbol.asyncIterator](),
          predicate as (val: T) => boolean
        )
      )
    ) as AsyncExtendedIterable<T> | AsyncExtendedIterable<T2>;
  }

  /**
   * Reduces the async iterable to a single value.
   * Without an initial value, the first element is used as the accumulator.
   * Throws TypeError on empty iterables when no initial value is provided.
   */
  async reduce(fn: (acc: T, val: T) => T | Promise<T>): Promise<T>;
  async reduce<U>(
    fn: (acc: U, val: T) => U | Promise<U>,
    initialValue: U
  ): Promise<U>;
  async reduce<U>(
    fn: (acc: T | U, val: T) => T | U | Promise<T | U>,
    ...rest: [] | [U]
  ): Promise<T | U> {
    const it = this[Symbol.asyncIterator]();
    let acc: T | U;
    if (rest.length > 0) {
      acc = rest[0];
    } else {
      const first = await it.next();
      if (first.done) {
        throw new TypeError('Reduce of empty iterable with no initial value');
      }
      acc = first.value;
    }
    for (let r = await it.next(); !r.done; r = await it.next()) {
      acc = await fn(acc, r.value);
    }
    return acc;
  }

  /**
   * Collects all elements into an array.
   */
  async collect(): Promise<T[]> {
    const arr: T[] = [];
    for await (const val of this) {
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
    return new AsyncExtendedIterable<T>(
      asyncIterableFrom(() =>
        new AsyncTakeIterator(source[Symbol.asyncIterator](), n)
      )
    );
  }

  /**
   * Tests whether at least one element passes the predicate.
   * Short-circuits on first match. Predicate can be sync or async.
   */
  async some(
    predicate: (val: T) => boolean | Promise<boolean>
  ): Promise<boolean> {
    for await (const val of this) {
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
    for await (const val of this) {
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
   */
  async splice(
    matcher: (val: T) => boolean | Promise<boolean>,
    deleteCount: number,
    insertIterable: AsyncIterable<T> | Iterable<T>
  ): Promise<{
    deleted: AsyncExtendedIterable<T>;
    sliced: AsyncExtendedIterable<T>;
  }> {
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
      this,
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

async function* asSettledGen<T>(
  promises: Iterable<Promise<T>>
): AsyncGenerator<PromiseSettledResult<T>> {
  const queue: PromiseSettledResult<T>[] = [];
  let notifyReady: (() => void) | null = null;
  let remaining = 0;

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

  while (remaining > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        notifyReady = resolve;
      });
      notifyReady = null;
    }

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
