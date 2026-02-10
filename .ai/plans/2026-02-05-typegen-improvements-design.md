# Typegen Improvements Design

## Problem

The `generateMetadataTypes` function in `src/schema/typegen.ts` produces incomplete TypeScript types when JSON Schemas contain complex structures:

- **Union types (`anyOf`/`oneOf`)** → outputs `unknown`
- **Nested objects** → sometimes lost
- **`additionalProperties`** → outputs `Record<string, unknown>` instead of proper type

Example: The test plugin's rich schema (167 lines) generates only `test?: unknown`.

## Solution

Enhance `schemaTypeToTS` to handle additional JSON Schema constructs.

### Changes to `schemaTypeToTS`

Add handling **before** the `type` switch statement:

```typescript
// Union types (Zod's z.union becomes anyOf)
if (schema.anyOf) {
  const variants = (schema.anyOf as Record<string, unknown>[])
    .map((s) => schemaTypeToTS(s));
  return variants.join(' | ');
}

// Discriminated unions (oneOf)
if (schema.oneOf) {
  const variants = (schema.oneOf as Record<string, unknown>[])
    .map((s) => schemaTypeToTS(s));
  return variants.join(' | ');
}

// Intersection types (allOf)
if (schema.allOf) {
  const variants = (schema.allOf as Record<string, unknown>[])
    .map((s) => schemaTypeToTS(s));
  return variants.join(' & ');
}
```

### Enhanced `object` case

Handle `additionalProperties` for dictionary types:

```typescript
case 'object': {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const additionalProps = schema.additionalProperties;

  // Dictionary type: { additionalProperties: { type: "string" } }
  if (!properties && additionalProps && typeof additionalProps === 'object') {
    return `Record<string, ${schemaTypeToTS(additionalProps as Record<string, unknown>)}>`;
  }

  if (!properties) return 'Record<string, unknown>';

  // ... existing property handling
}
```

## Expected Output

Before:
```typescript
export interface ExampleMetadata {
  test?: unknown;
}
```

After:
```typescript
export interface ExampleMetadata {
  test?: {
    name: string;
    options: {
      command: string;
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    };
    assertions?: {
      exitCode?: number;
      stdout?: { contains?: string; matches?: string };
      stderr?: { contains?: string; matches?: string };
    };
  } | Array<{ ... }>;
}
```

## Scope

- Modify `packages/functional-examples/src/schema/typegen.ts`
- Add tests for new schema patterns
- Regenerate examples to verify output
