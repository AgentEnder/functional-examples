#!/usr/bin/env node
/**
 * functional-examples CLI
 *
 * Built with cli-forge
 */

import { cli } from 'cli-forge';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';

const app = cli('functional-examples', {
  description: 'Extract and manage code examples',
})
  .version('0.0.1')
  .commands(scanCommand, validateCommand, initCommand, generateCommand);

export default app;

// Run the CLI
app.forge();
