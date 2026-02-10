import { cli, type CLI } from 'cli-forge';
import { describe, expect, it, vi } from 'vitest';
import type { Plugin, ResolvedConfig } from '../types/index.js';
import {
  getCommandNamespace,
  loadPluginCommands,
  resolvePluginCommands,
} from './plugin-commands.js';

/** Helper to access CLI name at runtime */
function getCliName(c: CLI): string {
  return (c as CLI & { name: string }).name;
}

describe('getCommandNamespace', () => {
  it('strips @functional-examples/ scope', () => {
    expect(getCommandNamespace('@functional-examples/test')).toBe('test');
    expect(getCommandNamespace('@functional-examples/foo-bar')).toBe('foo-bar');
  });

  it('keeps other scopes intact', () => {
    expect(getCommandNamespace('@acme/runner')).toBe('@acme/runner');
    expect(getCommandNamespace('@other/plugin')).toBe('@other/plugin');
  });

  it('keeps unscoped names intact', () => {
    expect(getCommandNamespace('my-plugin')).toBe('my-plugin');
    expect(getCommandNamespace('simple')).toBe('simple');
  });
});

describe('resolvePluginCommands', () => {
  const mockConfig = {} as ResolvedConfig<unknown>;

  it('returns empty array when no commands', async () => {
    const plugin: Plugin = { name: 'test' };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toEqual([]);
  });

  it('returns static commands array', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(testCmd);
  });

  it('calls function and returns commands', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: () => [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
  });

  it('handles async function', async () => {
    const testCmd = cli('test', {});
    const plugin: Plugin = {
      name: 'test',
      commands: async () => [testCmd],
    };
    const result = await resolvePluginCommands(plugin, mockConfig);
    expect(result).toHaveLength(1);
  });
});

describe('loadPluginCommands', () => {
  const mockConfig = {} as ResolvedConfig<unknown>;

  it('returns empty array for empty plugins array', async () => {
    const result = await loadPluginCommands([], mockConfig);
    expect(result).toEqual([]);
  });

  it('skips plugin with no commands', async () => {
    const plugins: Plugin[] = [{ name: 'no-commands' }];
    const result = await loadPluginCommands(plugins, mockConfig);
    expect(result).toEqual([]);
  });

  it('uses single command directly when name matches namespace', async () => {
    const testCmd = cli('runner', {});
    const plugins: Plugin[] = [
      {
        name: '@functional-examples/runner',
        commands: [testCmd],
      },
    ];
    const result = await loadPluginCommands(plugins, mockConfig);
    expect(result).toHaveLength(1);
    // Should be the original command, not wrapped
    expect(getCliName(result[0])).toBe('runner');
    expect(result[0].getHandler()).toBe(testCmd.getHandler());
  });

  it('wraps single command when name does not match namespace', async () => {
    const testCmd = cli('run', {});
    const plugins: Plugin[] = [
      {
        name: '@functional-examples/runner',
        commands: [testCmd],
      },
    ];
    const result = await loadPluginCommands(plugins, mockConfig);
    expect(result).toHaveLength(1);
    // Should be wrapped under namespace
    expect(getCliName(result[0])).toBe('runner');
    // Should NOT be the original command
    expect(result[0]).not.toBe(testCmd);
  });

  it('wraps multiple commands under namespace', async () => {
    const cmd1 = cli('build', {});
    const cmd2 = cli('serve', {});
    const plugins: Plugin[] = [
      {
        name: '@functional-examples/dev',
        commands: [cmd1, cmd2],
      },
    ];
    const result = await loadPluginCommands(plugins, mockConfig);
    expect(result).toHaveLength(1);
    // Should be wrapped under namespace
    expect(getCliName(result[0])).toBe('dev');
    // Should NOT be either original command
    expect(result[0]).not.toBe(cmd1);
    expect(result[0]).not.toBe(cmd2);
  });

  it('passes config to commands function', async () => {
    const testCmd = cli('test', {});
    const commandsFn = vi.fn().mockReturnValue([testCmd]);
    const plugins: Plugin[] = [
      {
        name: 'test',
        commands: commandsFn,
      },
    ];
    const testConfig = { foo: 'bar' } as unknown as ResolvedConfig<unknown>;

    await loadPluginCommands(plugins, testConfig);

    expect(commandsFn).toHaveBeenCalledOnce();
    expect(commandsFn).toHaveBeenCalledWith(testConfig);
  });
});
