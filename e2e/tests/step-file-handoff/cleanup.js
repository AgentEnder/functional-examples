import { unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
unlinkSync(join(dir, '.tmp-output'));
console.log('cleaned up');
