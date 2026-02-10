import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, '.tmp-output'), 'handoff-value-42');
console.log('wrote .tmp-output');
