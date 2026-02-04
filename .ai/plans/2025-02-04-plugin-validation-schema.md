# Plugin Validation & Schema Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add validation and schema generation to the plugin system, enabling IDE autocomplete for config files and runtime validation of both plugin options and extracted metadata.

**Key Concepts:**
- **Options validation**: Validates plugin configuration BEFORE extraction
- **Metadata validation**: Validates extracted example metadata AFTER extraction
- **User metadata schema**: Config-level schema defines base metadata contract (overrides plugin schemas on conflict)
- **Schema generation**: Produces JSON Schema for config files (IDE autocomplete)
- **Type generation**: Produces TypeScript types for metadata (type-safe access)

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Nx monorepo, JSON Schema

---

## Phase 1: Core Type Definitions

### Task 1: Add ValidationResult Type

**Files:**
- Modify: `packages/functional-examples/src/types/index.ts`

**Step 1: Add ValidationResult type**

Add to `packages/functional-examples/src/types/index.ts`:

```typescript
/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** Validation errors (empty if success is true) */
  errors: ValidationError[];
}

/**
 * A single validation error.
 */
export interface ValidationError {
  /** JSON path to the invalid value (e.g., "metadata.tags[0]") */
  path: string;
  /** Human-readable error message */
  message: string;
}
```

**Step 2: Verify types compile**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/functional-examples/src/types/index.ts
git commit -m "feat(types): add ValidationResult interface"
```

---

### Task 2: Extend Plugin Interface with Schemas and Validators

**Files:**
- Modify: `packages/functional-examples/src/types/index.ts`

**Step 1: Add schema and validator properties to Plugin**

Update the `Plugin` interface in `packages/functional-examples/src/types/index.ts`:

```typescript
/**
 * Schema definitions for a plugin (JSON Schema format).
 * Used for IDE autocomplete and documentation generation.
 */
export interface PluginSchemas {
  /**
   * JSON Schema for plugin options (passed to createPlugin()).
   * Used to generate config file schema for IDE autocomplete.
   */
  options?: string;

  /**
   * JSON Schema for metadata this plugin produces or expects.
   * Used for metadata.d.ts generation and documentation.
   */
  metadata?: string;
}

/**
 * Validator functions for a plugin.
 * Allows plugins to use any validation library (Zod, TypeBox, etc.)
 */
export interface PluginValidators<TMetadata = Record<string, unknown>> {
  /**
   * Validates plugin options before extraction begins.
   * Called during config resolution.
   * @param options - The options passed to the plugin factory
   */
  options?: (options: unknown) => ValidationResult;

  /**
   * Validates extracted metadata after all extractors complete.
   * Called for each example's metadata.
   * @param metadata - The metadata from an extracted example
   */
  metadata?: (metadata: TMetadata) => ValidationResult;
}

/**
 * Plugin containing optional extractors, parsers, schemas, and validators.
 * Auto-registers for declared file extensions.
 */
export interface Plugin<TMetadata = Record<string, unknown>> {
  /** Unique plugin name */
  readonly name: string;

  /** File extensions this plugin handles (e.g., ['.ts', '.tsx', '.js', '.jsx']) */
  readonly extensions?: string[];

  /** Extractor that finds examples in a directory tree */
  readonly extractor?: Extractor<TMetadata>;

  /** Parser that processes file contents (runs in pipeline order) */
  readonly fileContentsParser?: FileContentsParser;

  /**
   * JSON Schema definitions for IDE tooling.
   * @see PluginSchemas
   */
  readonly schemas?: PluginSchemas;

  /**
   * Runtime validators for options and metadata.
   * @see PluginValidators
   */
  readonly validators?: PluginValidators<TMetadata>;
}
```

**Step 2: Verify types compile**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/functional-examples/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add schemas and validators to Plugin interface

- PluginSchemas: JSON Schema strings for options and metadata
- PluginValidators: Runtime validation functions
- Options validated before extraction
- Metadata validated after extraction
EOF
)"
```

---

### Task 3: Export New Types from Package

**Files:**
- Modify: `packages/functional-examples/src/index.ts`

**Step 1: Add exports**

Add to exports in `packages/functional-examples/src/index.ts`:

```typescript
// Validation types
export type {
  ValidationResult,
  ValidationError,
  PluginSchemas,
  PluginValidators,
} from './types/index.js';
```

**Step 2: Verify exports**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsc --noEmit -p packages/functional-examples/tsconfig.lib.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/functional-examples/src/index.ts
git commit -m "feat: export validation types from main package"
```

---

## Phase 2: Validation Infrastructure

### Task 4: Add Validation Methods to PluginRegistry

**Files:**
- Modify: `packages/functional-examples/src/plugins/registry.ts`
- Test: `packages/functional-examples/src/plugins/registry.spec.ts`

**Step 1: Add tests for new registry methods**

Add to `packages/functional-examples/src/plugins/registry.spec.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/registry.spec.ts`
Expected: FAIL (methods don't exist)

**Step 3: Implement the methods**

Add to `packages/functional-examples/src/plugins/registry.ts`:

```typescript
import type {
  Plugin,
  Extractor,
  FileContentsParser,
  ValidationResult,
  PluginSchemas,
} from '../types/index.js';

export interface PluginValidator<T = unknown> {
  pluginName: string;
  validate: (value: T) => ValidationResult;
}

export interface PluginSchemaEntry {
  pluginName: string;
  options?: string;
  metadata?: string;
}

// Add these methods to the PluginRegistry class:

/**
 * Get all options validators from registered plugins.
 */
getOptionsValidators(): PluginValidator<unknown>[] {
  return this.plugins
    .filter((p) => p.validators?.options !== undefined)
    .map((p) => ({
      pluginName: p.name,
      validate: p.validators!.options!,
    }));
}

/**
 * Get all metadata validators from registered plugins.
 */
getMetadataValidators(): PluginValidator[] {
  return this.plugins
    .filter((p) => p.validators?.metadata !== undefined)
    .map((p) => ({
      pluginName: p.name,
      validate: p.validators!.metadata!,
    }));
}

/**
 * Get all schemas from registered plugins.
 */
getSchemas(): PluginSchemaEntry[] {
  return this.plugins
    .filter((p) => p.schemas !== undefined)
    .map((p) => ({
      pluginName: p.name,
      options: p.schemas!.options,
      metadata: p.schemas!.metadata,
    }));
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/registry.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/functional-examples/src/plugins/
git commit -m "$(cat <<'EOF'
feat(plugins): add validation and schema methods to PluginRegistry

- getOptionsValidators(): collect options validators
- getMetadataValidators(): collect metadata validators
- getSchemas(): collect JSON schemas from all plugins
EOF
)"
```

---

### Task 5: Create Validation Runner

**Files:**
- Create: `packages/functional-examples/src/plugins/validation.ts`
- Test: `packages/functional-examples/src/plugins/validation.spec.ts`

**Step 1: Write the failing test**

Create `packages/functional-examples/src/plugins/validation.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  validatePluginOptions,
  validateExampleMetadata,
  type PluginOptionsValidationContext,
  type MetadataValidationContext,
} from './validation.js';
import type { ValidationResult } from '../types/index.js';

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
        { pluginName: 'plugin-a', validate: () => ({ success: true, errors: [] }) },
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
        ? { success: false, errors: [{ path: 'required', message: 'is required' }] }
        : { success: true, errors: [] }
    );

    const context: MetadataValidationContext = {
      validators: [{ pluginName: 'validator', validate: validator }],
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
        { pluginName: 'v1', validate: () => ({ success: false, errors: [{ path: 'a', message: 'err1' }] }) },
        { pluginName: 'v2', validate: () => ({ success: false, errors: [{ path: 'b', message: 'err2' }] }) },
      ],
      examples: [{ id: 'ex1', metadata: {} }],
    };

    const result = validateExampleMetadata(context);

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].pluginName).toBe('v1');
    expect(result.errors[1].pluginName).toBe('v2');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/validation.spec.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `packages/functional-examples/src/plugins/validation.ts`:

```typescript
import type { ValidationResult } from '../types/index.js';
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/plugins/validation.spec.ts`
Expected: PASS

**Step 5: Update exports**

Add to `packages/functional-examples/src/plugins/index.ts`:

```typescript
export {
  validatePluginOptions,
  validateExampleMetadata,
  type PluginOptionsValidationContext,
  type MetadataValidationContext,
  type OptionsValidationResult,
  type MetadataValidationResult,
  type OptionsValidationError,
  type MetadataValidationError,
} from './validation.js';
```

**Step 6: Commit**

```bash
git add packages/functional-examples/src/plugins/
git commit -m "$(cat <<'EOF'
feat(plugins): add validation runner functions

- validatePluginOptions(): runs before extraction
- validateExampleMetadata(): runs after extraction
- Both collect all errors without failing fast
EOF
)"
```

---

### Task 6: Integrate Options Validation into Config Resolution

**Files:**
- Modify: `packages/functional-examples/src/config/resolver.ts`
- Test: `packages/functional-examples/src/config/resolver.spec.ts`

**Step 1: Add options validation to resolveConfig**

The config resolver should:
1. Build the PluginRegistry from config
2. Run options validators before returning
3. Throw or return errors if validation fails

```typescript
// In resolveConfig():

// After registering all plugins...
const optionsValidators = registry.getOptionsValidators();

if (optionsValidators.length > 0) {
  // Build plugin options map from config
  const pluginOptions = new Map<string, unknown>();
  for (const plugin of config.plugins ?? []) {
    // Plugin factories should attach options to the plugin instance
    // or we need to track options separately during registration
    if ('_options' in plugin) {
      pluginOptions.set(plugin.name, plugin._options);
    }
  }

  const validationResult = validatePluginOptions({
    validators: optionsValidators,
    pluginOptions,
  });

  if (!validationResult.success) {
    // Convert to config validation errors
    for (const error of validationResult.errors) {
      errors.push({
        path: `plugins.${error.pluginName}.${error.path}`,
        message: error.message,
      });
    }
  }
}
```

**Note:** This task requires design decision on how plugin options flow through the system. Options are passed to factory functions like `createJavaScriptPlugin(options)`, but the resulting Plugin object doesn't retain them. We may need to:
- Add an `_options` field to Plugin interface
- Or track options separately during config loading
- Or pass options map explicitly to resolveConfig

**Step 2: Write tests**

Add to resolver tests covering options validation integration.

**Step 3: Commit**

```bash
git add packages/functional-examples/src/config/
git commit -m "feat(config): integrate options validation into config resolution"
```

---

### Task 7: Integrate Metadata Validation into Scanner

**Files:**
- Modify: `packages/functional-examples/src/scanner/scanner.ts`
- Test: `packages/functional-examples/src/scanner/scanner.spec.ts`

**Step 1: Add metadata validation phase to scanExamples**

After all extractors complete and file contents are processed:

```typescript
// In scanExamples(), after extraction and file processing...

// Run metadata validators
const metadataValidators = registry.getMetadataValidators();

if (metadataValidators.length > 0) {
  const validationResult = validateExampleMetadata({
    validators: metadataValidators,
    examples: examples.map((e) => ({ id: e.id, metadata: e.metadata })),
  });

  // Convert validation errors to ExtractorErrors
  for (const error of validationResult.errors) {
    errors.push({
      path: `example:${error.exampleId}`,
      message: `[${error.pluginName}] ${error.path}: ${error.message}`,
    });
  }
}
```

**Step 2: Write tests**

Add to `packages/functional-examples/src/scanner/scanner.spec.ts`:

```typescript
describe('scanExamples with metadata validation', () => {
  it('should run metadata validators after extraction', async () => {
    const validateFn = vi.fn(() => ({ success: true, errors: [] }));

    const plugin: Plugin = {
      name: 'validator-plugin',
      validators: { metadata: validateFn },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [{
              id: 'test',
              title: 'Test',
              rootPath: tempDir,
              files: [],
              metadata: { custom: 'value' },
              extractorName: 'test',
            }],
            errors: [],
            claimedFiles: new Set(),
          };
        },
      },
    };

    await scanExamples({ root: tempDir, plugins: [plugin] });

    expect(validateFn).toHaveBeenCalledWith({ custom: 'value' });
  });

  it('should collect metadata validation errors', async () => {
    const plugin: Plugin = {
      name: 'strict-validator',
      validators: {
        metadata: (m: Record<string, unknown>) =>
          m.required
            ? { success: true, errors: [] }
            : { success: false, errors: [{ path: 'required', message: 'field is required' }] },
      },
      extractor: {
        name: 'test',
        async extract() {
          return {
            examples: [{
              id: 'missing-required',
              title: 'Test',
              rootPath: tempDir,
              files: [],
              metadata: {},
              extractorName: 'test',
            }],
            errors: [],
            claimedFiles: new Set(),
          };
        },
      },
    };

    const result = await scanExamples({ root: tempDir, plugins: [plugin] });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('required');
    expect(result.errors[0].message).toContain('strict-validator');
  });
});
```

**Step 3: Commit**

```bash
git add packages/functional-examples/src/scanner/
git commit -m "feat(scanner): integrate metadata validation into scan pipeline"
```

---

## Phase 3: Schema Generation

### Task 8: Create Schema Merger Utility

**Files:**
- Create: `packages/functional-examples/src/schema/merger.ts`
- Test: `packages/functional-examples/src/schema/merger.spec.ts`

**Step 1: Write the failing test**

Create `packages/functional-examples/src/schema/merger.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mergeConfigSchema } from './merger.js';

describe('mergeConfigSchema', () => {
  it('should create base config schema with no plugins', () => {
    const schema = mergeConfigSchema({ pluginSchemas: [] });

    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('plugins');
    expect(schema.properties).toHaveProperty('scan');
    expect(schema.properties).toHaveProperty('pathMappings');
    expect(schema.properties).toHaveProperty('metadata');
  });

  it('should include plugin options schemas', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        {
          pluginName: 'javascript',
          options: JSON.stringify({
            type: 'object',
            properties: {
              skipFrontmatter: { type: 'boolean' },
            },
          }),
        },
      ],
    });

    expect(schema.$defs).toHaveProperty('javascriptOptions');
    expect(schema.$defs.javascriptOptions.properties).toHaveProperty('skipFrontmatter');
  });

  it('should reference plugin schemas in plugins array items', () => {
    const schema = mergeConfigSchema({
      pluginSchemas: [
        { pluginName: 'javascript', options: '{"type":"object"}' },
        { pluginName: 'yaml-manifest', options: '{"type":"object"}' },
      ],
    });

    // The plugins array should allow items matching any registered plugin
    const pluginsSchema = schema.properties.plugins;
    expect(pluginsSchema.items.anyOf).toBeDefined();
    expect(pluginsSchema.items.anyOf).toHaveLength(2);
  });

  it('should produce valid JSON Schema', () => {
    const schema = mergeConfigSchema({ pluginSchemas: [] });

    // Should be parseable as JSON
    const json = JSON.stringify(schema);
    expect(() => JSON.parse(json)).not.toThrow();

    // Should have $schema
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});

describe('mergeMetadataSchemas', () => {
  it('should return config schema when no plugin schemas', () => {
    const configSchema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [],
    });

    expect(result).toEqual(configSchema);
  });

  it('should merge plugin metadata schemas', () => {
    const result = mergeMetadataSchemas({
      pluginSchemas: [
        { pluginName: 'a', metadata: '{"type":"object","properties":{"foo":{"type":"string"}}}' },
        { pluginName: 'b', metadata: '{"type":"object","properties":{"bar":{"type":"number"}}}' },
      ],
    });

    expect(result.properties).toHaveProperty('foo');
    expect(result.properties).toHaveProperty('bar');
  });

  it('should give config schema priority over plugin schemas on conflict', () => {
    const configSchema = {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 5 }, // Config says minLength: 5
      },
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [
        {
          pluginName: 'plugin',
          metadata: JSON.stringify({
            type: 'object',
            properties: {
              id: { type: 'string', minLength: 1 }, // Plugin says minLength: 1
              title: { type: 'string' },
            },
          }),
        },
      ],
    });

    // Config wins - minLength should be 5, not 1
    expect(result.properties.id.minLength).toBe(5);
    // Plugin's non-conflicting property is still included
    expect(result.properties).toHaveProperty('title');
  });

  it('should merge required arrays with config taking precedence', () => {
    const configSchema = {
      type: 'object',
      properties: {},
      required: ['id', 'title'],
    };

    const result = mergeMetadataSchemas({
      configSchema,
      pluginSchemas: [
        {
          pluginName: 'plugin',
          metadata: JSON.stringify({
            type: 'object',
            properties: {},
            required: ['id', 'category'], // Plugin wants category required
          }),
        },
      ],
    });

    // Union of required fields
    expect(result.required).toContain('id');
    expect(result.required).toContain('title');
    expect(result.required).toContain('category');
  });
});
```

**Step 2: Write the implementation**

Create `packages/functional-examples/src/schema/merger.ts`:

```typescript
import type { PluginSchemaEntry } from '../plugins/registry.js';

export interface JSONSchema {
  $schema?: string;
  $defs?: Record<string, JSONSchema>;
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  anyOf?: JSONSchema[];
  $ref?: string;
  [key: string]: unknown;
}

export interface MergeConfigSchemaOptions {
  pluginSchemas: PluginSchemaEntry[];
}

export interface MergeMetadataSchemasOptions {
  /** User-defined metadata schema from config (takes priority) */
  configSchema?: JSONSchema;
  /** Plugin metadata schemas */
  pluginSchemas: PluginSchemaEntry[];
}

/**
 * Base config schema structure.
 */
function createBaseConfigSchema(): JSONSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      plugins: {
        type: 'array',
        description: 'Plugins to use for scanning and parsing',
        items: { type: 'object' }, // Will be replaced with anyOf
      },
      metadata: {
        type: 'object',
        description: 'JSON Schema defining the expected metadata structure for examples',
      },
      scan: {
        type: 'object',
        properties: {
          include: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to include',
          },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to exclude',
          },
        },
      },
      pathMappings: {
        type: 'array',
        description: 'Path mappings for conflict resolution',
        items: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            extractor: { type: 'string' },
          },
          required: ['pattern', 'extractor'],
        },
      },
      generate: {
        type: 'object',
        properties: {
          outputDir: {
            type: 'string',
            description: 'Output directory for generated files',
          },
        },
      },
    },
    $defs: {},
  };
}

/**
 * Merge plugin schemas into a complete config schema.
 */
export function mergeConfigSchema(options: MergeConfigSchemaOptions): JSONSchema {
  const { pluginSchemas } = options;
  const schema = createBaseConfigSchema();
  const pluginRefs: JSONSchema[] = [];

  for (const { pluginName, options: optionsSchema } of pluginSchemas) {
    if (!optionsSchema) continue;

    const defName = `${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Options`;

    try {
      const parsed = JSON.parse(optionsSchema);
      schema.$defs![defName] = {
        ...parsed,
        description: `Options for ${pluginName} plugin`,
      };

      pluginRefs.push({
        type: 'object',
        properties: {
          name: { const: pluginName },
          options: { $ref: `#/$defs/${defName}` },
        },
      });
    } catch {
      // Invalid JSON schema, skip
      console.warn(`Invalid options schema for plugin ${pluginName}`);
    }
  }

  // Update plugins array to use anyOf if we have plugin schemas
  if (pluginRefs.length > 0) {
    schema.properties!.plugins = {
      type: 'array',
      description: 'Plugins to use for scanning and parsing',
      items: { anyOf: pluginRefs },
    };
  }

  return schema;
}

/**
 * Deep merge two JSON Schema objects.
 * Second schema (b) takes priority on conflicts.
 */
function deepMergeSchemas(a: JSONSchema, b: JSONSchema): JSONSchema {
  const result: JSONSchema = { ...a };

  for (const [key, value] of Object.entries(b)) {
    if (key === 'properties' && result.properties && typeof value === 'object') {
      // Merge properties, b takes priority
      result.properties = {
        ...result.properties,
        ...(value as Record<string, JSONSchema>),
      };
    } else if (key === 'required' && Array.isArray(result.required) && Array.isArray(value)) {
      // Union required arrays
      result.required = [...new Set([...result.required, ...value])];
    } else {
      // b takes priority for all other fields
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merge metadata schemas from config and plugins.
 * Config schema takes priority on conflicts.
 */
export function mergeMetadataSchemas(options: MergeMetadataSchemasOptions): JSONSchema {
  const { configSchema, pluginSchemas } = options;

  // Start with empty base or config schema
  let merged: JSONSchema = configSchema ?? {
    type: 'object',
    properties: {},
  };

  // Merge in plugin schemas (config already in merged, so it has priority)
  for (const { pluginName, metadata } of pluginSchemas) {
    if (!metadata) continue;

    try {
      const pluginSchema = JSON.parse(metadata);
      // Merge plugin into current, but then overlay config again for priority
      const withPlugin = deepMergeSchemas(pluginSchema, merged);
      // Re-apply config schema to ensure it wins on conflicts
      merged = configSchema ? deepMergeSchemas(withPlugin, configSchema) : withPlugin;
    } catch {
      console.warn(`Invalid metadata schema for plugin ${pluginName}`);
    }
  }

  return merged;
}
```

**Step 3: Run tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/schema/merger.spec.ts`
Expected: PASS

**Step 4: Create index and update exports**

Create `packages/functional-examples/src/schema/index.ts`:

```typescript
export {
  mergeConfigSchema,
  mergeMetadataSchemas,
  type JSONSchema,
  type MergeConfigSchemaOptions,
  type MergeMetadataSchemasOptions,
} from './merger.js';
```

**Step 5: Commit**

```bash
git add packages/functional-examples/src/schema/
git commit -m "$(cat <<'EOF'
feat(schema): add config and metadata schema merger utilities

- mergeConfigSchema(): creates full config JSON Schema
- mergeMetadataSchemas(): merges plugin metadata schemas with config
- Config schema takes priority over plugin schemas on conflicts
EOF
)"
```

---

### Task 9: Create Type Generator Utility

**Files:**
- Create: `packages/functional-examples/src/schema/typegen.ts`
- Test: `packages/functional-examples/src/schema/typegen.spec.ts`

**Step 1: Write the failing test**

Create `packages/functional-examples/src/schema/typegen.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateMetadataTypes } from './typegen.js';

describe('generateMetadataTypes', () => {
  it('should generate interface from merged schema', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        category: { type: 'string', enum: ['tutorial', 'recipe'] },
      },
      required: ['id', 'title'],
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('export interface ExampleMetadata');
    expect(result).toContain('id: string');
    expect(result).toContain('title: string');
    expect(result).toContain('category?: "tutorial" | "recipe"');
  });

  it('should mark required fields without optional modifier', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        required: { type: 'string' },
        optional: { type: 'string' },
      },
      required: ['required'],
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('required: string');
    expect(result).toContain('optional?: string');
  });

  it('should generate valid TypeScript for various types', () => {
    const mergedSchema = {
      type: 'object',
      properties: {
        str: { type: 'string' },
        num: { type: 'number' },
        bool: { type: 'boolean' },
        arr: { type: 'array', items: { type: 'string' } },
        constVal: { const: 'fixed' },
      },
    };

    const result = generateMetadataTypes({ mergedSchema });

    expect(result).toContain('str?: string');
    expect(result).toContain('num?: number');
    expect(result).toContain('bool?: boolean');
    expect(result).toContain('arr?: Array<string>');
    expect(result).toContain('constVal?: "fixed"');
  });

  it('should return Record<string, unknown> when no schema provided', () => {
    const result = generateMetadataTypes({});

    expect(result).toContain('export type ExampleMetadata = Record<string, unknown>');
  });

  it('should handle empty properties object', () => {
    const result = generateMetadataTypes({
      mergedSchema: { type: 'object', properties: {} },
    });

    expect(result).toContain('export interface ExampleMetadata');
  });
});
```

**Step 2: Write the implementation**

Create `packages/functional-examples/src/schema/typegen.ts`:

```typescript
import type { JSONSchema } from './merger.js';

export interface GenerateMetadataTypesOptions {
  /** Pre-merged metadata schema (from mergeMetadataSchemas) */
  mergedSchema?: JSONSchema;
}

/**
 * Convert JSON Schema type to TypeScript type.
 */
function schemaTypeToTS(schema: Record<string, unknown>): string {
  const type = schema.type as string | undefined;

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }

  if (schema.enum) {
    return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  }

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      return items ? `Array<${schemaTypeToTS(items)}>` : 'unknown[]';
    }
    case 'object': {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (!properties) return 'Record<string, unknown>';

      const required = new Set((schema.required as string[]) ?? []);
      const props = Object.entries(properties)
        .map(([key, propSchema]) => {
          const optional = required.has(key) ? '' : '?';
          return `  ${key}${optional}: ${schemaTypeToTS(propSchema)};`;
        })
        .join('\n');

      return `{\n${props}\n}`;
    }
    default:
      return 'unknown';
  }
}

/**
 * Generate TypeScript interface from JSON Schema.
 */
function generateInterface(name: string, schema: JSONSchema): string {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return `export interface ${name} extends Record<string, unknown> {}`;
  }

  const required = new Set((schema.required as string[]) ?? []);
  const props = Object.entries(properties)
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? '' : '?';
      const tsType = schemaTypeToTS(propSchema);
      return `  ${key}${optional}: ${tsType};`;
    })
    .join('\n');

  return `export interface ${name} {\n${props}\n}`;
}

const HEADER = `/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 */

`;

/**
 * Generate TypeScript type declarations from merged metadata schema.
 */
export function generateMetadataTypes(options: GenerateMetadataTypesOptions): string {
  const { mergedSchema } = options;

  if (!mergedSchema || !mergedSchema.properties) {
    return `${HEADER}export type ExampleMetadata = Record<string, unknown>;\n`;
  }

  const interfaceCode = generateInterface('ExampleMetadata', mergedSchema);

  return `${HEADER}${interfaceCode}\n`;
}
```

**Step 3: Run tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/functional-examples/src/schema/typegen.spec.ts`
Expected: PASS

**Step 4: Update exports**

Add to `packages/functional-examples/src/schema/index.ts`:

```typescript
export {
  generateMetadataTypes,
  type GenerateMetadataTypesOptions,
} from './typegen.js';
```

**Step 5: Commit**

```bash
git add packages/functional-examples/src/schema/
git commit -m "feat(schema): add TypeScript metadata type generator"
```

---

## Phase 4: CLI Command

### Task 10: Add Generate Command to CLI

**Files:**
- Create: `packages/functional-examples/src/cli/generate.ts`
- Modify: `packages/functional-examples/src/cli/index.ts`

**Step 1: Implement generate command**

Create `packages/functional-examples/src/cli/generate.ts`:

```typescript
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadConfig, resolveConfig } from '../config/index.js';
import { PluginRegistry } from '../plugins/registry.js';
import { mergeConfigSchema, mergeMetadataSchemas } from '../schema/merger.js';
import { generateMetadataTypes } from '../schema/typegen.js';

interface GenerateOptions {
  config?: string;
  output?: string;
}

const DEFAULT_OUTPUT_DIR = '.functional-examples';

export const generateCommand = new Command('generate')
  .description('Generate JSON Schema and TypeScript types from config and plugins')
  .option('-c, --config <path>', 'Path to config file')
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .action(async (options: GenerateOptions) => {
    try {
      // Load and resolve config
      const config = await loadConfig(options.config);
      const resolved = await resolveConfig(config);

      // Build registry from plugins
      const registry = new PluginRegistry();
      for (const plugin of resolved.plugins ?? []) {
        registry.register(plugin);
      }

      // Get schemas from all plugins
      const pluginSchemas = registry.getSchemas();

      // Generate outputs
      const outputDir = path.resolve(
        process.cwd(),
        options.output ?? config.generate?.outputDir ?? DEFAULT_OUTPUT_DIR
      );
      await fs.mkdir(outputDir, { recursive: true });

      // Generate config schema (for IDE autocomplete of config file)
      const configSchema = mergeConfigSchema({ pluginSchemas });
      const schemaPath = path.join(outputDir, 'schema.json');
      await fs.writeFile(schemaPath, JSON.stringify(configSchema, null, 2));
      console.log(`✓ Generated ${schemaPath}`);

      // Merge metadata schemas (config takes priority over plugins)
      const mergedMetadataSchema = mergeMetadataSchemas({
        configSchema: config.metadata,
        pluginSchemas,
      });

      // Generate metadata types from merged schema
      const metadataTypes = generateMetadataTypes({
        mergedSchema: mergedMetadataSchema,
      });
      const typesPath = path.join(outputDir, 'metadata.d.ts');
      await fs.writeFile(typesPath, metadataTypes);
      console.log(`✓ Generated ${typesPath}`);

      // Also output the merged metadata schema for reference
      const metadataSchemaPath = path.join(outputDir, 'metadata.schema.json');
      await fs.writeFile(metadataSchemaPath, JSON.stringify(mergedMetadataSchema, null, 2));
      console.log(`✓ Generated ${metadataSchemaPath}`);

      console.log('\nDone! Add to your config file:');
      console.log(`  "$schema": "./${options.output ?? config.generate?.outputDir ?? DEFAULT_OUTPUT_DIR}/schema.json"`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
```

**Step 2: Register command in CLI**

Add to `packages/functional-examples/src/cli/index.ts`:

```typescript
import { generateCommand } from './generate.js';

// ... existing commands ...

program.addCommand(generateCommand);
```

**Step 3: Test manually**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec tsx packages/functional-examples/src/cli/index.ts generate --help`
Expected: Shows generate command help

**Step 4: Commit**

```bash
git add packages/functional-examples/src/cli/
git commit -m "$(cat <<'EOF'
feat(cli): add generate command for schema and type generation

- Generates .functional-examples/schema.json (config file schema)
- Generates .functional-examples/metadata.d.ts (TypeScript types)
- Generates .functional-examples/metadata.schema.json (merged metadata schema)
- Config metadata schema takes priority over plugin schemas
- Configurable output directory via CLI flag or config
EOF
)"
```

---

### Task 11: Add Metadata Schema and Generate Config to Config

**Files:**
- Modify: `packages/functional-examples/src/config/types.ts`
- Modify: `packages/functional-examples/src/config/schema.ts`

**Step 1: Add metadata schema and generate config to BaseConfig**

Add to `packages/functional-examples/src/config/types.ts`:

```typescript
/**
 * JSON Schema type for config file (subset of JSON Schema spec).
 * Users can provide a full JSON Schema object to define their metadata contract.
 */
export interface JSONSchemaObject {
  type?: string;
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: unknown[];
  const?: unknown;
  description?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the generate command output.
 */
export interface GenerateConfig {
  /** Output directory for generated files (default: .functional-examples) */
  outputDir?: string;
}

export interface BaseConfig<TMetadata = Record<string, unknown>> {
  // ... existing properties ...

  /**
   * JSON Schema defining the expected metadata structure for examples.
   * This is the user's base metadata contract - all examples must conform to it.
   * Overrides plugin metadata schemas on conflict.
   *
   * @example
   * ```typescript
   * metadata: {
   *   type: 'object',
   *   properties: {
   *     id: { type: 'string' },
   *     title: { type: 'string' },
   *     category: { type: 'string', enum: ['tutorial', 'recipe', 'reference'] },
   *     difficulty: { type: 'number', minimum: 1, maximum: 5 },
   *   },
   *   required: ['id', 'title', 'category'],
   * }
   * ```
   */
  metadata?: JSONSchemaObject;

  /** Configuration for schema/type generation */
  generate?: GenerateConfig;
}
```

**Step 2: Update Zod schema**

Add to `packages/functional-examples/src/config/schema.ts`:

```typescript
// JSON Schema is complex - use passthrough for flexibility, validate structure minimally
const jsonSchemaObjectSchema: z.ZodType<JSONSchemaObject> = z.object({
  type: z.string().optional(),
  properties: z.record(z.lazy(() => jsonSchemaObjectSchema)).optional(),
  required: z.array(z.string()).optional(),
  items: z.lazy(() => jsonSchemaObjectSchema).optional(),
  enum: z.array(z.unknown()).optional(),
  const: z.unknown().optional(),
  description: z.string().optional(),
}).passthrough();

const generateConfigSchema = z.object({
  outputDir: z.string().optional(),
});

// Add to configSchema:
metadata: jsonSchemaObjectSchema.optional(),
generate: generateConfigSchema.optional(),
```

**Step 3: Update generate command to use config**

```typescript
// In generate.ts action:
const outputDir = path.resolve(
  process.cwd(),
  options.output ?? config.generate?.outputDir ?? DEFAULT_OUTPUT_DIR
);
```

**Step 4: Commit**

```bash
git add packages/functional-examples/src/config/
git commit -m "$(cat <<'EOF'
feat(config): add metadata schema and generate config

- metadata: JSON Schema object defining base metadata contract
- generate.outputDir: configurable output directory
- User metadata schema overrides plugin schemas on conflict
EOF
)"
```

---

## Phase 5: Update JavaScript Plugin with Schemas

### Task 12: Add Schemas and Validators to JavaScript Plugin

**Files:**
- Modify: `packages/javascript/src/index.ts`
- Test: `packages/javascript/src/index.spec.ts`

**Step 1: Define schemas for JavaScript plugin**

```typescript
// In packages/javascript/src/index.ts

const OPTIONS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    additionalExtensions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional file extensions to scan',
    },
    exclude: {
      type: 'array',
      items: { type: 'string' },
      description: 'Glob patterns to exclude',
    },
    skipFrontmatter: {
      type: 'boolean',
      description: 'Skip frontmatter parsing',
    },
    skipRegions: {
      type: 'boolean',
      description: 'Skip region parsing',
    },
  },
});

const METADATA_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique example identifier',
    },
    title: {
      type: 'string',
      description: 'Example title',
    },
    description: {
      type: 'string',
      description: 'Example description',
    },
  },
  required: ['id', 'title'],
});

// Update createJavaScriptPlugin:
export function createJavaScriptPlugin(options: JavaScriptPluginOptions = {}): Plugin {
  return {
    name: 'javascript',
    extensions: [...JAVASCRIPT_EXTENSIONS],
    extractor: createJavaScriptExtractor(options),
    fileContentsParser: createCombinedParser(options),
    schemas: {
      options: OPTIONS_SCHEMA,
      metadata: METADATA_SCHEMA,
    },
    validators: {
      metadata: (metadata: Record<string, unknown>) => {
        const errors: Array<{ path: string; message: string }> = [];

        if (typeof metadata.id !== 'string' || !metadata.id) {
          errors.push({ path: 'id', message: 'must be a non-empty string' });
        }
        if (typeof metadata.title !== 'string' || !metadata.title) {
          errors.push({ path: 'title', message: 'must be a non-empty string' });
        }

        return { success: errors.length === 0, errors };
      },
    },
  };
}
```

**Step 2: Add tests**

Add to `packages/javascript/src/index.spec.ts`:

```typescript
describe('schemas', () => {
  it('should include options schema', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.schemas?.options).toBeDefined();
    expect(() => JSON.parse(plugin.schemas!.options!)).not.toThrow();
  });

  it('should include metadata schema', () => {
    const plugin = createJavaScriptPlugin();
    expect(plugin.schemas?.metadata).toBeDefined();
    expect(() => JSON.parse(plugin.schemas!.metadata!)).not.toThrow();
  });
});

describe('validators', () => {
  it('should validate metadata with id and title', () => {
    const plugin = createJavaScriptPlugin();
    const result = plugin.validators!.metadata!({ id: 'test', title: 'Test' });
    expect(result.success).toBe(true);
  });

  it('should reject metadata without id', () => {
    const plugin = createJavaScriptPlugin();
    const result = plugin.validators!.metadata!({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.errors[0].path).toBe('id');
  });
});
```

**Step 3: Run tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm exec vitest run packages/javascript/`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/javascript/
git commit -m "$(cat <<'EOF'
feat(javascript): add schemas and validators to plugin

- OPTIONS_SCHEMA: JSON Schema for plugin configuration
- METADATA_SCHEMA: JSON Schema for extracted metadata
- Metadata validator requires id and title
EOF
)"
```

---

## Phase 6: Documentation and Final Cleanup

### Task 13: Export Schema Utilities from Main Package

**Files:**
- Modify: `packages/functional-examples/src/index.ts`

**Step 1: Add exports**

```typescript
// Schema utilities
export {
  mergeConfigSchema,
  mergeMetadataSchemas,
  generateMetadataTypes,
  type JSONSchema,
  type MergeConfigSchemaOptions,
  type MergeMetadataSchemasOptions,
  type GenerateMetadataTypesOptions,
} from './schema/index.js';
```

**Step 2: Commit**

```bash
git add packages/functional-examples/src/index.ts
git commit -m "feat: export schema utilities from main package"
```

---

### Task 14: Run Full Test Suite and Build

**Step 1: Run all tests**

Run: `cd /Users/agentender/repos/functional-examples && pnpm test`
Expected: All PASS

**Step 2: Build all packages**

Run: `cd /Users/agentender/repos/functional-examples && pnpm build`
Expected: Success

**Step 3: Run linting**

Run: `cd /Users/agentender/repos/functional-examples && pnpm lint`
Expected: No errors

**Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix formatting and lint issues" || true
```

---

### Task 15: Update TODO.md

**Files:**
- Modify: `TODO.md` or `.ai/plans/TODO.md`

Mark completed:
- [x] Plugin schema/validation support
- [x] CLI command: generate JSON schema
- [x] CLI command: generate metadata.d.ts

---

## Summary

This plan implements:

1. **Validation System**
   - `Plugin.schemas`: `{ options?: string, metadata?: string }` - JSON Schema strings
   - `Plugin.validators`: `{ options?, metadata? }` - Runtime validation functions
   - Options validated before extraction (in config resolution)
   - Metadata validated after extraction (in scanner)
   - All errors collected, never fail-fast

2. **User-Defined Metadata Schema**
   - Config file accepts `metadata: JSONSchemaObject` to define base metadata contract
   - User schema takes priority over plugin schemas on conflicts
   - `mergeMetadataSchemas()`: Merges config + plugin schemas with proper precedence

3. **Schema Generation**
   - `mergeConfigSchema()`: Creates full config JSON Schema with plugin options
   - Output: `.functional-examples/schema.json`
   - Enables IDE autocomplete for config files

4. **Type Generation**
   - `generateMetadataTypes()`: Creates TypeScript types from merged metadata schema
   - Output: `.functional-examples/metadata.d.ts`
   - Provides type-safe access to extracted metadata

5. **CLI Command**
   - `functional-examples generate`: Outputs schema.json, metadata.d.ts, and metadata.schema.json
   - Configurable output directory (default: `.functional-examples/`)
   - Merges config metadata schema with plugin schemas

6. **JavaScript Plugin Enhancement**
   - Adds schemas for options and metadata
   - Adds metadata validator (requires id, title)

## Config Example

```typescript
// functional-examples.config.ts
export default {
  // User-defined metadata schema (takes priority over plugins)
  metadata: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      category: { type: 'string', enum: ['tutorial', 'recipe', 'reference'] },
      difficulty: { type: 'number', minimum: 1, maximum: 5 },
    },
    required: ['id', 'title', 'category'],
  },

  plugins: [
    createJavaScriptPlugin({ skipRegions: true }),
  ],

  generate: {
    outputDir: '.functional-examples',
  },
};
```
