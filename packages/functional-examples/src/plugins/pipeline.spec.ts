import { describe, it, expect } from 'vitest';
import { runParsePipeline, createInitialContext } from './pipeline.js';
import type { FileContentsParser } from '../types/index.js';

describe('createInitialContext', () => {
  it('should create context with raw content copied to parsed', () => {
    const ctx = createInitialContext('/path/to/file.ts', 'const x = 1;');

    expect(ctx).toEqual({
      raw: 'const x = 1;',
      parsed: 'const x = 1;',
      hunks: [],
      metadata: {},
      filePath: '/path/to/file.ts',
      regionConfig: { startTag: 'region', endTag: 'endregion' },
    });
  });
});

describe('runParsePipeline', () => {
  it('should run parsers in order, passing accumulated context', async () => {
    const calls: string[] = [];

    const parser1: FileContentsParser = {
      name: 'parser1',
      parse: (ctx) => {
        calls.push('parser1');
        return { ...ctx, metadata: { ...ctx.metadata, p1: true } };
      },
    };

    const parser2: FileContentsParser = {
      name: 'parser2',
      parse: (ctx) => {
        calls.push('parser2');
        return { ...ctx, metadata: { ...ctx.metadata, p2: true } };
      },
    };

    const initial = createInitialContext('/test.ts', 'code');
    const result = await runParsePipeline(initial, [parser1, parser2]);

    expect(calls).toEqual(['parser1', 'parser2']);
    expect(result.metadata).toEqual({ p1: true, p2: true });
  });

  it('should handle async parsers', async () => {
    const asyncParser: FileContentsParser = {
      name: 'async-parser',
      parse: async (ctx) => {
        await new Promise((r) => setTimeout(r, 1));
        return { ...ctx, parsed: ctx.parsed.toUpperCase() };
      },
    };

    const initial = createInitialContext('/test.ts', 'hello');
    const result = await runParsePipeline(initial, [asyncParser]);

    expect(result.parsed).toBe('HELLO');
  });

  it('should return initial context when no parsers provided', async () => {
    const initial = createInitialContext('/test.ts', 'code');
    const result = await runParsePipeline(initial, []);

    expect(result).toEqual(initial);
  });

  it('should accumulate hunks across parsers', async () => {
    const parser1: FileContentsParser = {
      name: 'hunk-parser-1',
      parse: (ctx) => ({
        ...ctx,
        hunks: [{ id: 'a', content: 'hunk-a', startLine: 1, endLine: 2 }],
      }),
    };

    const parser2: FileContentsParser = {
      name: 'hunk-parser-2',
      parse: (ctx) => ({
        ...ctx,
        hunks: [{ id: 'b', content: 'hunk-b', startLine: 3, endLine: 4 }],
      }),
    };

    const initial = createInitialContext('/test.ts', 'code');
    const result = await runParsePipeline(initial, [parser1, parser2]);

    expect(result.hunks).toHaveLength(2);
    expect(result.hunks[0].id).toBe('a');
    expect(result.hunks[1].id).toBe('b');
  });

  it('should give each parser an empty hunks slate', async () => {
    const receivedHunks: number[] = [];

    const parser1: FileContentsParser = {
      name: 'hunk-parser-1',
      parse: (ctx) => {
        receivedHunks.push(ctx.hunks.length);
        return {
          ...ctx,
          hunks: [{ id: 'a', content: 'hunk-a', startLine: 1, endLine: 2 }],
        };
      },
    };

    const parser2: FileContentsParser = {
      name: 'hunk-parser-2',
      parse: (ctx) => {
        receivedHunks.push(ctx.hunks.length);
        return {
          ...ctx,
          hunks: [{ id: 'b', content: 'hunk-b', startLine: 3, endLine: 4 }],
        };
      },
    };

    const initial = createInitialContext('/test.ts', 'code');
    await runParsePipeline(initial, [parser1, parser2]);

    // Both parsers should receive empty hunks
    expect(receivedHunks).toEqual([0, 0]);
  });
});
