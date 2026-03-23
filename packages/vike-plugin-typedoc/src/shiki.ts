import { type BundledTheme, codeToTokens, type ThemedToken } from 'shiki';

let _shikiPromise: Promise<void> | null = null;

async function ensureShiki(): Promise<void> {
  if (_shikiPromise) return _shikiPromise;
  _shikiPromise = (async () => {
    // Shiki lazy-loads grammars — just calling codeToTokens is enough
    // to initialize. No explicit setup needed with shiki 1.x+.
  })();
  return _shikiPromise;
}

export interface TokenizationResult {
  tokens: ThemedToken[][];
}

/**
 * Tokenize TypeScript code using Shiki.
 * Returns themed tokens with character-level offset information.
 */
export async function tokenize(
  code: string,
  theme: BundledTheme = 'github-dark'
): Promise<TokenizationResult> {
  await ensureShiki();
  const result = await codeToTokens(code, {
    lang: 'typescript',
    theme,
  });
  return { tokens: result.tokens };
}

/**
 * Render code to HTML using Shiki.
 */
export async function codeToHtml(
  code: string,
  theme: BundledTheme = 'github-dark'
): Promise<string> {
  const { codeToHtml: shikiCodeToHtml } = await import('shiki');
  return shikiCodeToHtml(code, {
    lang: 'typescript',
    theme,
  });
}

export type { BundledTheme } from 'shiki';
