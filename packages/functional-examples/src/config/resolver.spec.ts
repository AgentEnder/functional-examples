/**
 * Tests for configuration resolver
 */

import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from '../types/index.js';
import { resolveConfig } from './resolver.js';
import type { ConfigWithRoot } from './types.js';

describe('resolveConfig', () => {
  describe('plugin options validation', () => {
    it('should validate plugin options and report errors', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        _options: { timeout: -1 },
        validators: {
          options: (opts: unknown) => {
            const options = opts as { timeout?: number };
            if (options.timeout !== undefined && options.timeout < 0) {
              return {
                success: false,
                errors: [{ path: 'timeout', message: 'must be positive' }],
              };
            }
            return { success: true, errors: [] };
          },
        },
      };

      const config: ConfigWithRoot = {
        plugins: [plugin],
        root: '/virtual',
      };

      const result = await resolveConfig(config);

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0]).toEqual({
        path: 'plugins.test-plugin.timeout',
        message: 'must be positive',
      });
    });

    it('should pass when all plugin options are valid', async () => {
      const plugin: Plugin = {
        name: 'valid-plugin',
        _options: { timeout: 5000 },
        validators: {
          options: (opts: unknown) => {
            const options = opts as { timeout?: number };
            if (options.timeout !== undefined && options.timeout < 0) {
              return {
                success: false,
                errors: [{ path: 'timeout', message: 'must be positive' }],
              };
            }
            return { success: true, errors: [] };
          },
        },
      };

      const config: ConfigWithRoot = {
        plugins: [plugin],
        root: '/virtual',
      };

      const result = await resolveConfig(config);

      expect(result.validationErrors).toHaveLength(0);
    });

    it('should skip validation for plugins without _options', async () => {
      const validator = vi.fn(() => ({ success: true, errors: [] }));

      const plugin: Plugin = {
        name: 'no-options-plugin',
        // Note: no _options set
        validators: {
          options: validator,
        },
      };

      const config: ConfigWithRoot = {
        plugins: [plugin],
        root: '/virtual',
      };

      await resolveConfig(config);

      // Validator should not be called if plugin has no _options
      expect(validator).not.toHaveBeenCalled();
    });

    it('should collect errors from multiple plugins', async () => {
      const pluginA: Plugin = {
        name: 'plugin-a',
        _options: { invalid: true },
        validators: {
          options: () => ({
            success: false,
            errors: [{ path: 'invalid', message: 'must be false' }],
          }),
        },
      };

      const pluginB: Plugin = {
        name: 'plugin-b',
        _options: { missing: true },
        validators: {
          options: () => ({
            success: false,
            errors: [{ path: 'required', message: 'is required' }],
          }),
        },
      };

      const config: ConfigWithRoot = {
        plugins: [pluginA, pluginB],
        root: '/virtual',
      };

      const result = await resolveConfig(config);

      expect(result.validationErrors).toHaveLength(2);
      expect(result.validationErrors[0].path).toBe('plugins.plugin-a.invalid');
      expect(result.validationErrors[1].path).toBe('plugins.plugin-b.required');
    });
  });

  describe('plugin registry', () => {
    it('should build registry from config plugins', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        extensions: ['.test'],
      };

      const config: ConfigWithRoot = {
        plugins: [plugin],
        root: '/virtual',
      };

      const result = await resolveConfig(config);

      expect(result.registry.getPlugins()).toContain(plugin);
      expect(result.plugins).toContain(plugin);
    });

    it('should extract extractors from plugins', async () => {
      const extractor = {
        name: 'plugin-extractor',
        extract: async () => ({
          examples: [],
          errors: [],
          claimedFiles: new Set<string>(),
        }),
      };

      const plugin: Plugin = {
        name: 'extractor-plugin',
        extractor,
      };

      const config: ConfigWithRoot = {
        plugins: [plugin],
        root: '/virtual',
      };

      const result = await resolveConfig(config);

      expect(result.extractors).toContain(extractor);
    });
  });

  describe('defaults', () => {
    it('should apply default scan config', async () => {
      const result = await resolveConfig({ root: '/virtual' });

      expect(result.scan).toEqual({
        include: ['*'],  // Default when no examples/ directory exists
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        root: '/virtual',
      });
    });

    it('should merge user scan config with defaults', async () => {
      const result = await resolveConfig({
        root: '/virtual',
        scan: {
          include: ['examples/**'],
        },
      });

      expect(result.scan.include).toEqual(['examples/**']);
      expect(result.scan.exclude).toEqual([
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
      ]);
    });
  });
});
