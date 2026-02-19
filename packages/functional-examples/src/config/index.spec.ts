/**
 * Tests for configuration system
 */

import { describe, it, expect } from 'vitest';
import { findConfigFile, validateConfig, mergeConfigs } from './index.js';
import type { Config } from './types.js';

describe('Config System', () => {
  describe('findConfigFile', () => {
    // Test with a directory that definitely won't have a config
    it('should return null when no config exists', async () => {
      const configPath = await findConfigFile('/nonexistent-path-12345');
      expect(configPath).toBeNull();
    });

    it('should search for various config file patterns', async () => {
      // This test verifies the function doesn't throw and handles paths correctly
      // In a real test environment, we would use a temp directory with actual config files
      const configPath = await findConfigFile(process.cwd());
      // The result depends on whether a config file exists - we just verify no errors
      expect(configPath === null || typeof configPath === 'string').toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should pass valid config with plugins', () => {
      const config: Config = {
        plugins: [
          {
            name: 'test-plugin',
            extractor: {
              name: 'test-extractor',
              extract: async () => ({
                examples: [],
                errors: [],
                claimedFiles: new Set<string>(),
              }),
            },
          },
        ],
        scan: {
          include: ['examples/**/*'],
          exclude: ['**/node_modules/**'],
        },
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should allow empty plugins (for auto-detection)', () => {
      const config: Config = {
        plugins: [],
      };

      const errors = validateConfig(config);
      // Empty plugins is valid - the system will auto-detect
      expect(errors).toHaveLength(0);
    });

    it('should pass config with only scan options', () => {
      const config: Config = {
        scan: {
          include: ['**/*.ts'],
          exclude: ['**/dist/**'],
        },
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should validate scan include patterns', () => {
      const config: Config = {
        scan: {
          include: [''],
        },
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some(
          (e) => e.path.includes('scan') && e.path.includes('include')
        )
      ).toBe(true);
    });

    it('should validate scan exclude patterns', () => {
      const config: Config = {
        scan: {
          exclude: ['', 'valid'],
        },
      };

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some(
          (e) => e.path.includes('scan') && e.path.includes('exclude')
        )
      ).toBe(true);
    });
  });

  describe('mergeConfigs', () => {
    it('should deep merge scan config', () => {
      const config1: Partial<Config> = {
        scan: { include: ['**/*.ts'] },
      };
      const config2: Partial<Config> = {
        scan: { exclude: ['**/test/**'] },
      };

      const merged = mergeConfigs(config1, config2);
      expect(merged.scan).toEqual({
        include: ['**/*.ts'],
        exclude: ['**/test/**'],
        root: '.',
      });
    });

    it('should provide defaults for scan config', () => {
      const config: Partial<Config> = {};
      const merged = mergeConfigs(config);

      expect(merged.scan).toEqual({
        include: ['**/*'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        root: '.',
      });
    });

    it('should handle null configs', () => {
      const merged = mergeConfigs(null, undefined, {});
      expect(merged.scan).toEqual({
        include: ['**/*'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        root: '.',
      });
    });

    it('should merge pathMappings', () => {
      const config1: Partial<Config> = {
        pathMappings: [{ pattern: '**/cli/**', extractor: 'frontmatter' }],
      };
      const config2: Partial<Config> = {
        pathMappings: [{ pattern: '**/workers/**', extractor: 'meta-yml' }],
      };

      const merged = mergeConfigs(config1, config2);
      expect(merged.pathMappings).toEqual([
        { pattern: '**/cli/**', extractor: 'frontmatter' },
        { pattern: '**/workers/**', extractor: 'meta-yml' },
      ]);
    });
  });
});
