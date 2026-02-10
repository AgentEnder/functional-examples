#!/usr/bin/env node
import { cli } from 'cli-forge';
import { findConfigFile, loadConfig, resolveConfig } from '../config/index.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { loadPluginCommands } from './plugin-commands.js';

const app = cli('functional-examples', {
  description: 'Extract and manage code examples',
  builder: (args) =>
    args
      .option('config', {
        alias: ['c'],
        type: 'string',
      })
      .middleware(async (args) => {
        const configPath = args.config ?? (await findConfigFile(process.cwd()));
        if (!configPath) {
          throw new Error('Unable to locate config file');
        }
        args.config = configPath;
        const rawConfig = await loadConfig(configPath);
        const config = await resolveConfig(rawConfig);
        return {
          ...args,
          resolvedConfig: config,
        };
      })
      .init(async (cli, args) => {
        const plugins = args.resolvedConfig.plugins;
        const pluginCLIs = await loadPluginCommands(
          plugins,
          args.resolvedConfig
        );
        cli.commands(pluginCLIs);
      }),
})
  .version('0.0.1')
  .commands(scanCommand, validateCommand, initCommand, generateCommand);

async function main() {
  app.forge();
}

export default app;

// Run CLI when this is the entry point
main();
