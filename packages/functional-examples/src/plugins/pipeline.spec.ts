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
});
