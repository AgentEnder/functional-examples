import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import vike from 'vike/plugin';
import { defineConfig } from 'vite';
import { watchDocs, watchExamples } from './plugins';

const traceServerImport = () => ({
  name: 'trace-server-import',
  enforce: 'pre' as const,
  moduleParsed(info: { id: string; importedIds: string[]; dynamicallyImportedIds: string[] }) {
    for (const imp of [...info.importedIds, ...info.dynamicallyImportedIds]) {
      if (imp.includes('typedoc') && imp.includes('server')) {
        console.log(`>>> ${info.id}\n    -> ${imp}`);
      }
    }
  }
});

export default defineConfig({
  plugins: [traceServerImport(), vike(), react(), tailwindcss(), watchDocs(), watchExamples()],
  build: {
    rollupOptions: {
      external: ['/pagefind/pagefind.js'],
    },
  },
  // Externalize server-only packages that use native Node APIs or
  // dynamic requires (jiti) that break when bundled by Vite.
  ssr: {
    external: [
      'functional-examples',
      '@functional-examples/javascript',
      '@functional-examples/yaml-manifest',
      '@functional-examples/test',
      '@functional-examples/documentation',
      '@functional-examples/devkit',
      'gray-matter',
      'shiki',
    ],
  },
  base: process.env.BASE_URL || '/functional-examples',
  define: {
    'import.meta.env.PUBLIC_ENV__PREVIEW_PATH': JSON.stringify(process.env.PREVIEW_PATH || ''),
  },
});
