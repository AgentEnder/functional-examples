import type { ResolvedConfig } from '@functional-examples/devkit';
import type { ResolvedTestPluginOptions } from '../types.js';
import { createTestCommand } from './test.js';
import { createListCommand } from './list.js';

export function createTestCommands(
  config: ResolvedConfig,
  pluginOpts: ResolvedTestPluginOptions
) {
  // Main test command with list as subcommand
  const testCommand = createTestCommand(config, pluginOpts)
    .commands(createListCommand(config));

  return [testCommand];
}
