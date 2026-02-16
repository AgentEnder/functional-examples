import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import remarkCodeProps, {
  type RemarkCodePropsOptions,
} from './remark-code-props.js';

async function process(
  md: string,
  options?: RemarkCodePropsOptions
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkCodeProps, options)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe('text directive — :typedoc[symbol]{attrs}', () => {
  it('transforms to <code> with data attributes', async () => {
    const result = await process(
      'Use :typedoc[createMatcher]{pkg=devkit} here.'
    );
    expect(result).toContain('data-pkg="devkit"');
    expect(result).toContain('>createMatcher</code>');
  });

  it('handles multiple attributes', async () => {
    const result = await process(
      'Use :typedoc[foo]{pkg=devkit kind=function} here.'
    );
    expect(result).toContain('data-pkg="devkit"');
    expect(result).toContain('data-kind="function"');
    expect(result).toContain('>foo</code>');
  });

  it('works with no attributes', async () => {
    const result = await process('Use :typedoc[Plugin] here.');
    expect(result).toContain('<code>Plugin</code>');
  });

  it('does not transform non-typedoc directives', async () => {
    const result = await process('Use :other[text]{key=val} here.');
    expect(result).not.toContain('data-key');
    // Should not be a bare <code> element from our plugin
    expect(result).not.toContain('<code>text</code>');
  });
});

describe('leaf directive — ::typedoc{symbol="..." pkg="..."}', () => {
  const mockResolve = (name: string, pkg?: string) => {
    if (name === 'Plugin') {
      return pkg
        ? `export interface Plugin { name: string; pkg: "${pkg}"; }`
        : 'export interface Plugin { name: string; }';
    }
    return undefined;
  };

  it('produces a code block with resolved signature', async () => {
    const result = await process('::typedoc{symbol="Plugin"}', {
      resolveSignature: mockResolve,
    });
    expect(result).toContain('<code');
    expect(result).toContain('export interface Plugin { name: string; }');
  });

  it('passes pkg to resolveSignature', async () => {
    const result = await process(
      '::typedoc{symbol="Plugin" pkg="functional-examples"}',
      { resolveSignature: mockResolve }
    );
    expect(result).toContain('pkg: "functional-examples"');
  });

  it('does not transform when resolveSignature is not provided', async () => {
    const result = await process('::typedoc{symbol="Plugin"}');
    // Without resolveSignature, the node is left as-is (no code block)
    expect(result).not.toContain('export interface');
  });

  it('does not transform when resolveSignature returns undefined', async () => {
    const result = await process('::typedoc{symbol="NonExistent"}', {
      resolveSignature: mockResolve,
    });
    expect(result).not.toContain('export');
  });
});
