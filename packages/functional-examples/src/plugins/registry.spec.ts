import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from './registry.js';
import type { Plugin, FileParseContext } from '../types/index.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        extensions: ['.ts'],
      };

      registry.register(plugin);

      expect(registry.getPlugins()).toContain(plugin);
    });

    it('should throw on duplicate plugin names', () => {
      const plugin: Plugin = { name: 'test-plugin' };

      registry.register(plugin);

      expect(() => registry.register(plugin)).toThrow(
        'Plugin "test-plugin" is already registered'
      );
    });
  });

  describe('getPluginsForExtension', () => {
    it('should return plugins registered for an extension', () => {
      const tsPlugin: Plugin = {
        name: 'ts-plugin',
        extensions: ['.ts', '.tsx'],
      };
      const jsPlugin: Plugin = {
        name: 'js-plugin',
        extensions: ['.js'],
      };

      registry.register(tsPlugin);
      registry.register(jsPlugin);

      expect(registry.getPluginsForExtension('.ts')).toEqual([tsPlugin]);
      expect(registry.getPluginsForExtension('.tsx')).toEqual([tsPlugin]);
      expect(registry.getPluginsForExtension('.js')).toEqual([jsPlugin]);
      expect(registry.getPluginsForExtension('.py')).toEqual([]);
    });
  });

  describe('getExtractors', () => {
    it('should return all extractors from registered plugins', () => {
      const extractor1 = {
        name: 'extractor1',
        extract: async () => ({
          examples: [],
          errors: [],
          claimedFiles: new Set<string>(),
        }),
      };
      const extractor2 = {
        name: 'extractor2',
        extract: async () => ({
          examples: [],
          errors: [],
          claimedFiles: new Set<string>(),
        }),
      };

      registry.register({ name: 'plugin1', extractor: extractor1 });
      registry.register({ name: 'plugin2', extractor: extractor2 });
      registry.register({ name: 'plugin3' }); // no extractor

      expect(registry.getExtractors()).toEqual([extractor1, extractor2]);
    });
  });

  describe('getParsersForExtension', () => {
    it('should return parsers for plugins matching extension in registration order', () => {
      const parser1: Plugin['fileContentsParser'] = {
        name: 'parser1',
        parse: (ctx: FileParseContext) => ctx,
      };
      const parser2: Plugin['fileContentsParser'] = {
        name: 'parser2',
        parse: (ctx: FileParseContext) => ctx,
      };

      registry.register({
        name: 'plugin1',
        extensions: ['.ts'],
        fileContentsParser: parser1,
      });
      registry.register({
        name: 'plugin2',
        extensions: ['.ts'],
        fileContentsParser: parser2,
      });

      const parsers = registry.getParsersForExtension('.ts');
      expect(parsers).toEqual([parser1, parser2]);
    });

    it('should return empty array for unregistered extension', () => {
      const parser: Plugin['fileContentsParser'] = {
        name: 'parser1',
        parse: (ctx: FileParseContext) => ctx,
      };

      registry.register({
        name: 'plugin1',
        extensions: ['.ts'],
        fileContentsParser: parser,
      });

      expect(registry.getParsersForExtension('.py')).toEqual([]);
    });

    it('should skip plugins without parsers', () => {
      const parser: Plugin['fileContentsParser'] = {
        name: 'parser1',
        parse: (ctx: FileParseContext) => ctx,
      };

      registry.register({
        name: 'plugin1',
        extensions: ['.ts'],
        fileContentsParser: parser,
      });
      registry.register({
        name: 'plugin2',
        extensions: ['.ts'],
        // no parser
      });

      const parsers = registry.getParsersForExtension('.ts');
      expect(parsers).toHaveLength(1);
      expect(parsers[0]).toBe(parser);
    });
  });

  describe('getOptionsValidators', () => {
    it('should return options validators from registered plugins', () => {
      const validator = vi.fn(() => ({ success: true, errors: [] }));

      registry.register({
        name: 'test-plugin',
        validators: { options: validator },
      });

      const validators = registry.getOptionsValidators();
      expect(validators).toHaveLength(1);
      expect(validators[0].pluginName).toBe('test-plugin');
      expect(validators[0].validate).toBe(validator);
    });

    it('should skip plugins without options validators', () => {
      registry.register({ name: 'no-validator' });
      registry.register({
        name: 'has-validator',
        validators: { options: () => ({ success: true, errors: [] }) },
      });

      expect(registry.getOptionsValidators()).toHaveLength(1);
    });
  });

  describe('getMetadataValidators', () => {
    it('should return metadata validators from registered plugins', () => {
      const validator = vi.fn(() => ({ success: true, errors: [] }));

      registry.register({
        name: 'test-plugin',
        validators: { metadata: validator },
      });

      const validators = registry.getMetadataValidators();
      expect(validators).toHaveLength(1);
      expect(validators[0].pluginName).toBe('test-plugin');
    });
  });

  describe('getSchemas', () => {
    it('should collect all schemas from registered plugins', () => {
      registry.register({
        name: 'plugin-a',
        schemas: { options: '{"type":"object"}', metadata: '{"type":"string"}' },
      });
      registry.register({
        name: 'plugin-b',
        schemas: { options: '{"type":"number"}' },
      });
      registry.register({ name: 'plugin-c' }); // no schemas

      const schemas = registry.getSchemas();

      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toEqual({
        pluginName: 'plugin-a',
        options: '{"type":"object"}',
        metadata: '{"type":"string"}',
      });
      expect(schemas[1]).toEqual({
        pluginName: 'plugin-b',
        options: '{"type":"number"}',
        metadata: undefined,
      });
    });
  });
});
