import { describe, it, expect, vi } from 'vitest';
import type { ValidationResult } from '../types/index.js';
import {
  validatePluginOptions,
  validateExampleMetadata,
  type PluginOptionsValidationContext,
  type MetadataValidationContext,
} from './validation.js';

describe('validatePluginOptions', () => {
  it('should run all options validators and collect errors', () => {
    const validator1 = vi.fn(() => ({ success: true, errors: [] }));
    const validator2 = vi.fn(() => ({
      success: false,
      errors: [{ path: 'timeout', message: 'must be positive' }],
    }));

    const context: PluginOptionsValidationContext = {
      validators: [
        { pluginName: 'plugin-a', validate: validator1 },
        { pluginName: 'plugin-b', validate: validator2 },
      ],
      pluginOptions: new Map([
        ['plugin-a', { retries: 3 }],
        ['plugin-b', { timeout: -1 }],
      ]),
    };

    const result = validatePluginOptions(context);

    expect(validator1).toHaveBeenCalledWith({ retries: 3 });
    expect(validator2).toHaveBeenCalledWith({ timeout: -1 });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      pluginName: 'plugin-b',
      path: 'timeout',
      message: 'must be positive',
    });
  });

  it('should return success when all validators pass', () => {
    const context: PluginOptionsValidationContext = {
      validators: [
        {
          pluginName: 'plugin-a',
          validate: () => ({ success: true, errors: [] }),
        },
      ],
      pluginOptions: new Map([['plugin-a', {}]]),
    };

    const result = validatePluginOptions(context);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip validators for plugins without options', () => {
    const validator = vi.fn();

    const context: PluginOptionsValidationContext = {
      validators: [{ pluginName: 'plugin-a', validate: validator }],
      pluginOptions: new Map(), // no options for plugin-a
    };

    validatePluginOptions(context);

    expect(validator).not.toHaveBeenCalled();
  });
});

describe('validateExampleMetadata', () => {
  it('should run metadata validators on each example', () => {
    const validator = vi.fn(() => ({ success: true, errors: [] }));

    const context: MetadataValidationContext = {
      validators: [{ pluginName: 'plugin-a', validate: validator }],
      examples: [
        { id: 'ex1', metadata: { title: 'Example 1' } },
        { id: 'ex2', metadata: { title: 'Example 2' } },
      ],
    };

    validateExampleMetadata(context);

    expect(validator).toHaveBeenCalledTimes(2);
    expect(validator).toHaveBeenCalledWith({ title: 'Example 1' });
    expect(validator).toHaveBeenCalledWith({ title: 'Example 2' });
  });

  it('should collect errors with example context', () => {
    const validator = vi.fn((meta: { required?: boolean }) =>
      meta.required === undefined
        ? {
            success: false,
            errors: [{ path: 'required', message: 'is required' }],
          }
        : { success: true, errors: [] }
    );

    const context: MetadataValidationContext = {
      validators: [{ pluginName: 'validator', validate: validator as (value: unknown) => ValidationResult }],
      examples: [
        { id: 'valid', metadata: { required: true } },
        { id: 'invalid', metadata: {} },
      ],
    };

    const result = validateExampleMetadata(context);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      exampleId: 'invalid',
      pluginName: 'validator',
      path: 'required',
      message: 'is required',
    });
  });

  it('should run all validators on each example', () => {
    const context: MetadataValidationContext = {
      validators: [
        {
          pluginName: 'v1',
          validate: () => ({
            success: false,
            errors: [{ path: 'a', message: 'err1' }],
          }),
        },
        {
          pluginName: 'v2',
          validate: () => ({
            success: false,
            errors: [{ path: 'b', message: 'err2' }],
          }),
        },
      ],
      examples: [{ id: 'ex1', metadata: {} }],
    };

    const result = validateExampleMetadata(context);

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].pluginName).toBe('v1');
    expect(result.errors[1].pluginName).toBe('v2');
  });
});
