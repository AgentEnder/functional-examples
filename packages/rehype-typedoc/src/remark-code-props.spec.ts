import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import remarkCodeProps, { parsePropsPrefix } from './remark-code-props.js';

function process(md: string) {
  return unified()
    .use(remarkParse)
    .use(remarkCodeProps)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(md)
    .toString();
}

describe('parsePropsPrefix', () => {
  it('parses a single key-value pair', () => {
    const result = parsePropsPrefix('{pkg: devkit}createMatcher');
    expect(result).toEqual({
      props: { dataPkg: 'devkit' },
      rest: 'createMatcher',
    });
  });

  it('parses multiple key-value pairs', () => {
    const result = parsePropsPrefix('{pkg: devkit, kind: function}foo');
    expect(result).toEqual({
      props: { dataPkg: 'devkit', dataKind: 'function' },
      rest: 'foo',
    });
  });

  it('handles quoted values', () => {
    const result = parsePropsPrefix('{pkg: "my lib"}foo');
    expect(result).toEqual({
      props: { dataPkg: 'my lib' },
      rest: 'foo',
    });
  });

  it('handles single-quoted values', () => {
    const result = parsePropsPrefix("{pkg: 'my lib'}foo");
    expect(result).toEqual({
      props: { dataPkg: 'my lib' },
      rest: 'foo',
    });
  });

  it('returns null for strings not starting with {', () => {
    expect(parsePropsPrefix('createMatcher')).toBeNull();
  });

  it('returns null for unterminated brace', () => {
    expect(parsePropsPrefix('{pkg: devkit')).toBeNull();
  });

  it('returns null for missing colon', () => {
    expect(parsePropsPrefix('{pkg}foo')).toBeNull();
  });

  it('returns null for empty key', () => {
    expect(parsePropsPrefix('{: devkit}foo')).toBeNull();
  });
});

describe('remarkCodeProps', () => {
  it('transforms {key: val} prefix to data attributes', () => {
    const result = process('Use `{pkg: devkit}createMatcher` here.');
    expect(result).toContain('data-pkg="devkit"');
    expect(result).toContain('>createMatcher</code>');
    // The prefix should be stripped
    expect(result).not.toContain('{pkg');
  });

  it('leaves normal inline code unchanged', () => {
    const result = process('Use `createMatcher` here.');
    expect(result).toContain('<code>createMatcher</code>');
    expect(result).not.toContain('data-');
  });

  it('handles multiple props', () => {
    const result = process('Use `{pkg: devkit, kind: function}foo` here.');
    expect(result).toContain('data-pkg="devkit"');
    expect(result).toContain('data-kind="function"');
    expect(result).toContain('>foo</code>');
  });

  it('does not transform fenced code blocks', () => {
    const result = process('```\n{pkg: devkit}createMatcher\n```');
    // Fenced blocks are not inlineCode — should be untouched
    expect(result).toContain('{pkg: devkit}createMatcher');
  });

  it('handles curly braces that are not valid props (no colon)', () => {
    const result = process('Use `{something}` here.');
    // Not a valid props prefix — should remain as-is
    expect(result).toContain('{something}');
  });
});
