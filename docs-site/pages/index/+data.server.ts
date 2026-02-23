import type { PageContextServer } from 'vike/types';
import { renderMarkdown } from '../../server/utils/markdown.js';

export async function data(pageContext: PageContextServer) {
  const example = pageContext.globalContext.examples['basic-usage'];

  let quickStartHtml = '';
  if (example) {
    const scanFile = example.files.find(
      (file) => file.relativePath === 'scan.ts'
    );
    const hunk = scanFile?.hunks.find((h) => h.id === 'scan');
    if (hunk) {
      const regionContent =
        scanFile?.content
          .split('\n')
          .slice(hunk.startLine - 1, hunk.endLine)
          .join('\n') ?? '';
      quickStartHtml = await renderMarkdown(
        '```typescript\n' + regionContent + '\n```'
      );
    }
  }

  return { quickStartHtml };
}

export type PageData = Awaited<ReturnType<typeof data>>;
