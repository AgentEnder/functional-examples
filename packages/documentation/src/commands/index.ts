import type { ResolvedConfig } from '@functional-examples/devkit';
import type { ResolvedDocumentationPluginOptions } from '../schema.js';
import { createGenerateCommand } from './generate.js';

export function createDocumentationCommands(
  config: ResolvedConfig,
  pluginOpts: ResolvedDocumentationPluginOptions
) {
  return [createGenerateCommand(config, pluginOpts)];
}
