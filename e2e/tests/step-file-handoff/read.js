import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const content = readFileSync(join(dir, '.tmp-output'), 'utf8');
console.log(`read: ${content}`);
