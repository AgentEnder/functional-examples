import { cli, type CLI } from 'cli-forge';
import type { Plugin, ResolvedConfig } from '../types/index.js';

/**
 * Internal type to access CLI name property.
 * cli-forge CLI instances are InternalCLI at runtime which has a name property.
 */
interface CLIWithName extends CLI {
  name: string;
}

/**
 * Get the CLI namespace for a plugin.
 * Strips @functional-examples/ scope, keeps everything else.
 */
export function getCommandNamespace(pluginName: string): string {
  if (pluginName.startsWith('@functional-examples/')) {
    return pluginName.replace('@functional-examples/', '');
  }
  return pluginName;
}

/**
 * Resolve commands from a plugin (handles static array or function).
 */
export async function resolvePluginCommands<T>(
  plugin: Plugin<T>,
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  if (!plugin.commands) return [];

  const commands =
    typeof plugin.commands === 'function'
      ? plugin.commands(config)
      : plugin.commands;

  return Promise.resolve(commands);
}

/**
 * Load all plugin commands, wrapping each plugin's commands
 * under its namespace.
 */
export async function loadPluginCommands<T>(
  plugins: Plugin<T>[],
  config: ResolvedConfig<T>
): Promise<CLI[]> {
  const result: CLI[] = [];

  for (const plugin of plugins) {
    const commands = await resolvePluginCommands(plugin, config);
    if (commands.length === 0) continue;

    const namespace = getCommandNamespace(plugin.name);

    // If plugin has a single command with same name as namespace,
    // use it directly (for $0 pattern like test plugin)
    const firstCommand = commands[0] as CLIWithName;
    if (commands.length === 1 && firstCommand.name === namespace) {
      result.push(commands[0]);
    } else {
      // Wrap multiple commands under namespace
      const namespaced = cli(namespace, {
        description: `Commands from ${plugin.name}`,
      }).commands(...commands);

      result.push(namespaced);
    }
  }

  return result;
}
