import type { PluginValidator } from './registry.js';

/**
 * Error from options validation with plugin context.
 */
export interface OptionsValidationError {
  pluginName: string;
  path: string;
  message: string;
}

/**
 * Result of validating plugin options.
 */
export interface OptionsValidationResult {
  success: boolean;
  errors: OptionsValidationError[];
}

/**
 * Context for validating plugin options.
 */
export interface PluginOptionsValidationContext {
  validators: PluginValidator<unknown>[];
  pluginOptions: Map<string, unknown>;
}

/**
 * Validate plugin options before extraction.
 * Runs each plugin's options validator against its configured options.
 */
export function validatePluginOptions(
  context: PluginOptionsValidationContext
): OptionsValidationResult {
  const errors: OptionsValidationError[] = [];

  for (const { pluginName, validate } of context.validators) {
    const options = context.pluginOptions.get(pluginName);

    // Skip if no options provided for this plugin
    if (options === undefined) {
      continue;
    }

    const result = validate(options);

    if (!result.success) {
      for (const error of result.errors) {
        errors.push({
          pluginName,
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Error from metadata validation with example context.
 */
export interface MetadataValidationError {
  exampleId: string;
  pluginName: string;
  path: string;
  message: string;
}

/**
 * Result of validating example metadata.
 */
export interface MetadataValidationResult {
  success: boolean;
  errors: MetadataValidationError[];
}

/**
 * Minimal example shape for validation.
 */
export interface ExampleForValidation {
  id: string;
  metadata: Record<string, unknown>;
}

/**
 * Context for validating example metadata.
 */
export interface MetadataValidationContext {
  validators: PluginValidator[];
  examples: ExampleForValidation[];
}

/**
 * Validate example metadata after extraction.
 * Runs all metadata validators against each example's metadata.
 */
export function validateExampleMetadata(
  context: MetadataValidationContext
): MetadataValidationResult {
  const errors: MetadataValidationError[] = [];

  for (const example of context.examples) {
    for (const { pluginName, validate } of context.validators) {
      const result = validate(example.metadata);

      if (!result.success) {
        for (const error of result.errors) {
          errors.push({
            exampleId: example.id,
            pluginName,
            path: error.path,
            message: error.message,
          });
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
