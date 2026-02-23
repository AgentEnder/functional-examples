import type { PageContextServer } from 'vike/types';
import { renderMarkdown } from '../../server/utils/markdown.js';

export async function data(pageContext: PageContextServer) {
  const example = pageContext.globalContext.examples['basic-usage'];

  let quickStartHtml = '';
  if (example) {
    const hunk = example.file('scan.ts')?.region('scan')?.content;

    if (hunk) {
      quickStartHtml = await renderMarkdown('```typescript\n' + hunk + '\n```');
    }
  }

  return { quickStartHtml };
}

export type PageData = Awaited<ReturnType<typeof data>>;
