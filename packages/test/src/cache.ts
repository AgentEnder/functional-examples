import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_VERSION = 1;
const CACHE_SUBDIR = '.cache/functional-examples/test';
const CACHE_FILE = 'results.json';

export type TestStatus = 'passed' | 'failed' | 'not-started';

interface CacheData {
  version: number;
  results: Record<string, TestStatus>;
}

/** Walk up from startDir to find the nearest node_modules directory. */
function findNodeModules(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, 'node_modules');
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveCachePath(cwd: string): string | null {
  const nodeModules = findNodeModules(cwd);
  if (!nodeModules) return null;
  return join(nodeModules, CACHE_SUBDIR, CACHE_FILE);
}

function readCache(cachePath: string): CacheData {
  if (!existsSync(cachePath)) {
    return { version: CACHE_VERSION, results: {} };
  }
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as CacheData;
    if (parsed.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, results: {} };
    }
    return parsed;
  } catch {
    return { version: CACHE_VERSION, results: {} };
  }
}

function writeCache(cachePath: string, data: CacheData): void {
  mkdirSync(join(cachePath, '..'), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Key used to identify a test result in the cache. */
export function cacheKey(example: string, test: string): string {
  return `${example} > ${test}`;
}

export interface CacheStatusSummary {
  passed: number;
  failed: number;
  'not-started': number;
}

export interface TestCache {
  /** Absolute path to the cache file on disk. */
  path: string;
  /** Record a test status in the cache (written to disk). */
  record(example: string, test: string, status: TestStatus): void;
  /**
   * Return the set of "example > test" keys whose status is not 'passed'.
   * This includes both 'failed' and 'not-started' — used by --only-failed
   * to re-run anything that didn't succeed last time.
   */
  nonPassedKeys(): Set<string>;
  /** Count of each status across all cached entries. */
  statusSummary(): CacheStatusSummary;
}

/** Create a cache backed by node_modules/.cache/functional-examples/test/results.json. */
export function createTestCache(cwd: string = process.cwd()): TestCache | null {
  const cachePath = resolveCachePath(cwd);
  if (!cachePath) return null;

  const data = readCache(cachePath);

  return {
    path: cachePath,
    record(example, test, status) {
      data.results[cacheKey(example, test)] = status;
      writeCache(cachePath, data);
    },
    nonPassedKeys() {
      return new Set(
        Object.entries(data.results)
          .filter(([, v]) => v !== 'passed')
          .map(([k]) => k)
      );
    },
    statusSummary() {
      const summary: CacheStatusSummary = { passed: 0, failed: 0, 'not-started': 0 };
      for (const status of Object.values(data.results)) {
        summary[status]++;
      }
      return summary;
    },
  };
}
