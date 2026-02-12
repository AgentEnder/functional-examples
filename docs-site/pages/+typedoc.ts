import rehypeShiki from '@shikijs/rehype';
import { join } from 'node:path';
import { Config } from 'vike/types';
import { blueprintTheme } from '../server/utils/highlighter';
import { workspaceRoot } from '../server/utils/workspace';
import { applyBaseUrl } from '../utils/base-url';

const root = workspaceRoot();

export default {
  typedocDir: join(root, '.typedoc'),
  packagesDir: join(root, 'packages'),
  buildUrl: (pkg, sym) => applyBaseUrl(`api/${pkg}${sym ? '/' + sym : ''}`),
  rehypePlugins: [
    [rehypeShiki, { theme: blueprintTheme }],
  ],
} satisfies Config['typedoc'];
