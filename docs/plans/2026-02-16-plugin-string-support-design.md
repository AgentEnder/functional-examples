# Plugin String Support in Generated Schemas

**Date:** 2026-02-16
**Status:** Approved

## Problem

The generated JSON schemas don't support string plugin references, even though the TypeScript types and runtime resolver do.

**Current State:**
- TypeScript type: `PluginReference = string | [string, Record<string, unknown>]`
- Runtime resolver handles both strings and tuples correctly
- Generated schema only supports object format: `{ name: string, options: {...} }`
- JSON configs use strings: `"@functional-examples/javascript"`

**Result:** JSON configs with string plugins fail schema validation despite being valid at runtime.

## Solution

Update `mergeConfigSchema()` in `packages/functional-examples/src/schema/merger.ts` to generate a schema that accepts:

1. **String format:** `"@functional-examples/javascript"` (uses default options)
2. **Tuple format:** `["@functional-examples/javascript", { options }]`

## Design

### Generated Schema Structure

The `plugins` array schema will enumerate known plugins explicitly, plus generic fallbacks for unknown plugins:

```json
{
  "plugins": {
    "type": "array",
    "description": "Plugins to use for scanning and parsing",
    "items": {
      "anyOf": [
        // Explicit string forms (one per known plugin)
        { "const": "@functional-examples/javascript" },
        { "const": "@functional-examples/yaml-manifest" },

        // Explicit tuple forms (one per plugin with options schema)
        {
          "type": "array",
          "prefixItems": [
            { "const": "@functional-examples/javascript" },
            { "$ref": "#/$defs/JavaScriptOptions" }
          ],
          "minItems": 2,
          "maxItems": 2
        },
        {
          "type": "array",
          "prefixItems": [
            { "const": "@functional-examples/yaml-manifest" },
            { "$ref": "#/$defs/YamlManifestOptions" }
          ],
          "minItems": 2,
          "maxItems": 2
        },

        // Generic fallbacks for unknown/third-party plugins
        {
          "type": "string",
          "description": "Unknown plugin package name"
        },
        {
          "type": "array",
          "description": "Unknown plugin with options",
          "prefixItems": [
            { "type": "string" },
            { "type": "object" }
          ],
          "minItems": 1,
          "maxItems": 2
        }
      ]
    }
  }
}
```

### Benefits

- **IDE autocomplete** for known plugins
- **Type-safe validation** for known plugin options
- **Flexibility** for unknown/third-party plugins
- **Matches TypeScript types** exactly

### Implementation Changes

**File:** `packages/functional-examples/src/schema/merger.ts`

**Function:** `mergeConfigSchema()`

**Current logic:**
```typescript
// Only creates object-based plugin refs
for (const { pluginName, options: optionsSchema } of pluginSchemas) {
  pluginRefs.push({
    type: 'object',
    properties: {
      name: { const: pluginName },
      options: { $ref: `#/$defs/${defName}` }
    }
  });
}
```

**New logic:**
```typescript
const pluginRefs: JSONSchema[] = [];

// Generate explicit schemas for plugins with options
for (const { pluginName, options: optionsSchema } of pluginSchemas) {
  if (!optionsSchema) continue;

  const defName = `${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Options`;

  // Add to $defs (existing logic)
  const parsed = JSON.parse(optionsSchema) as JSONSchema;
  const defs = schema.$defs ?? {};
  defs[defName] = { ...parsed, description: `Options for ${pluginName} plugin` };
  schema.$defs = defs;

  // 1. String format for this plugin
  pluginRefs.push({ const: pluginName });

  // 2. Tuple format for this plugin
  pluginRefs.push({
    type: 'array',
    prefixItems: [
      { const: pluginName },
      { $ref: `#/$defs/${defName}` }
    ],
    minItems: 2,
    maxItems: 2
  });
}

// Add generic fallbacks for unknown plugins
pluginRefs.push(
  { type: 'string', description: 'Unknown plugin package name' },
  {
    type: 'array',
    description: 'Unknown plugin with options',
    prefixItems: [
      { type: 'string' },
      { type: 'object' }
    ],
    minItems: 1,
    maxItems: 2
  }
);
```

### Edge Cases

**1. Plugin without options schema:**
- Appears as string const in `anyOf`
- No tuple form (since no options to validate)
- Covered by generic string fallback

**2. Empty plugins array:**
- Only generic fallbacks in `anyOf`
- Still allows any plugin to be used

**3. Tuple with only plugin name (no options):**
- Generic tuple fallback handles `["plugin-name"]` with `minItems: 1`
- String format is preferred for this case

## Testing

1. Generate schema in example with string plugins
2. Verify IDE autocomplete suggests known plugins
3. Verify validation accepts both string and tuple formats
4. Verify validation catches invalid options for known plugins
5. Verify unknown plugins work with generic fallbacks

## Backwards Compatibility

**Breaking change:** None. JSON configs using object format `{ name, options }` were never valid, so changing to string/tuple format doesn't break existing configs.

## Next Steps

1. Implement changes in `merger.ts`
2. Add tests for new schema generation
3. Update example configs to use string format
4. Regenerate schemas in all examples
5. Update documentation
