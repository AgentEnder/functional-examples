import { describe, expect, it } from 'vitest';
import { tokenize, codeToHtml } from './shiki.js';

describe('shiki', () => {
  describe('tokenize', () => {
    it('should return themed tokens for simple TypeScript code', async () => {
      const result = await tokenize('const x: number = 42;');
      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
      // Each line should have at least one token
      for (const line of result.tokens) {
        expect(line.length).toBeGreaterThan(0);
      }
    });

    it('should include color information in tokens', async () => {
      const result = await tokenize('function hello(): string { return "hi"; }');
      const allTokens = result.tokens.flat();
      // Every themed token should have a color property
      for (const token of allTokens) {
        expect(token.color).toBeDefined();
        expect(typeof token.color).toBe('string');
      }
    });

    it('should return consistent results across calls (singleton behavior)', async () => {
      const code = 'type Foo = { bar: string };';
      const result1 = await tokenize(code);
      const result2 = await tokenize(code);
      expect(result1).toEqual(result2);
    });
  });

  describe('codeToHtml', () => {
    it('should return an HTML string with syntax highlighting', async () => {
      const html = await codeToHtml('const y = true;');
      expect(typeof html).toBe('string');
      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      // Should contain styled spans for syntax tokens
      expect(html).toContain('<span');
    });
  });
});
