import { join } from 'node:path';
import { createOnBeforePrerenderStart } from 'vike-plugin-typedoc/server';
import { workspaceRoot } from '../../../../server/utils/workspace.js';

const root = workspaceRoot();

export default createOnBeforePrerenderStart({
  typedocDir: join(root, '.typedoc'),
  packagesDir: join(root, 'packages'),
});
