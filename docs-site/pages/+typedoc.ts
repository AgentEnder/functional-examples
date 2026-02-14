import rehypeShiki from '@shikijs/rehype';
import { join } from 'node:path';
import { Config } from 'vike/types';
import { blueprintTheme } from '../server/utils/highlighter';
import { workspaceRoot } from '../server/utils/workspace';

const root = workspaceRoot();

export default {
  typedocDir: join(root, '.typedoc'),
  packagesDir: join(root, 'packages'),
  rehypePlugins: [[rehypeShiki, { theme: blueprintTheme }]],
  exclude: ['rehype-typedoc', 'vike-plugin-typedoc'],
} satisfies Config['typedoc'];
