#!/usr/bin/env node
import { cli } from 'cli-forge';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { loadPluginCommands } from './plugin-commands.js';
import { loadConfig, findConfigFile, resolveConfig } from '../config/index.js';

async function main() {
  const app = cli('functional-examples', {
    description: 'Extract and manage code examples',
  })
    .version('0.0.1')
    .commands(scanCommand, validateCommand, initCommand, generateCommand);

  // Try to load config and register plugin commands
  try {
    const configPath = await findConfigFile(process.cwd());
    if (configPath) {
      const config = await loadConfig(configPath);
      const resolved = await resolveConfig(config);

      if (resolved.plugins.length > 0) {
        const pluginCLIs = await loadPluginCommands(resolved.plugins, resolved);
        if (pluginCLIs.length > 0) {
          app.commands(...pluginCLIs);
        }
      }
    }
  } catch {
    // Config loading failed - continue without plugin commands
    // Individual commands will report config errors as needed
  }

  app.forge();
}

const app = cli('functional-examples', {
  description: 'Extract and manage code examples',
})
  .version('0.0.1')
  .commands(scanCommand, validateCommand, initCommand, generateCommand);

export default app;

main();
