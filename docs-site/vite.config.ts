import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import vike from 'vike/plugin';
import { defineConfig } from 'vite';
import { watchDocs, watchExamples } from './plugins';

export default defineConfig({
  plugins: [vike(), react(), tailwindcss(), watchDocs(), watchExamples()],
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
});
