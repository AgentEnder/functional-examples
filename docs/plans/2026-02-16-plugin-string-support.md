# Plugin String Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update schema generation to support string and tuple plugin references matching TypeScript `PluginReference` type.

**Architecture:** Modify `mergeConfigSchema()` to generate explicit `const` schemas for known plugins (string + tuple forms) plus generic fallbacks for unknown plugins. This provides IDE autocomplete for known plugins while maintaining flexibility.

**Tech Stack:** TypeScript, Vitest, JSON Schema Draft 2020-12

---

## Task 1: Add test for string plugin format

**Files:**
- Modify: `packages/functional-examples/src/schema/merger.spec.ts:48`

**Step 1: Write failing test for string plugin references**

Add this test after the existing "should reference plugin schemas in plugins array items" test:

```typescript
it('should support string plugin references', () => {
  const schema = mergeConfigSchema({
    pluginSchemas: [
      { pluginName: '@functional-examples/javascript', options: '{"type":"object"}' },
      { pluginName: '@functional-examples/yaml-manifest', options: '{"type":"object"}' },
    ],
  });

  const properties = schema.properties ?? {};
  const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
  const anyOf = pluginsSchema.items?.anyOf ?? [];

  // Should include string const for each plugin
  const stringRefs = anyOf.filter((item: any) => item.const);
  expect(stringRefs).toHaveLength(2);
  expect(stringRefs).toContainEqual({ const: '@functional-examples/javascript' });
  expect(stringRefs).toContainEqual({ const: '@functional-examples/yaml-manifest' });
});
```

**Step 2: Run test to verify it fails**

Run: `npx nx run functional-examples:test --testFile=merger.spec.ts`

Expected: FAIL with test showing no string const entries in anyOf

**Step 3: Commit test**

```bash
git add packages/functional-examples/src/schema/merger.spec.ts
git commit -m "test: add test for string plugin references"
```

---

## Task 2: Add test for tuple plugin format

**Files:**
- Modify: `packages/functional-examples/src/schema/merger.spec.ts` (after previous test)

**Step 1: Write failing test for tuple plugin references**

Add this test after the string plugin test:

```typescript
it('should support tuple plugin references with options', () => {
  const schema = mergeConfigSchema({
    pluginSchemas: [
      {
        pluginName: '@functional-examples/javascript',
        options: JSON.stringify({
          type: 'object',
          properties: { skipFrontmatter: { type: 'boolean' } },
        }),
      },
    ],
  });

  const properties = schema.properties ?? {};
  const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
  const anyOf = pluginsSchema.items?.anyOf ?? [];

  // Should include tuple schema with const name + options ref
  const tupleRefs = anyOf.filter((item: any) =>
    item.type === 'array' && item.prefixItems?.[0]?.const
  );
  expect(tupleRefs.length).toBeGreaterThan(0);

  const jsTuple = tupleRefs.find((item: any) =>
    item.prefixItems[0].const === '@functional-examples/javascript'
  );
  expect(jsTuple).toBeDefined();
  expect(jsTuple.prefixItems).toHaveLength(2);
  expect(jsTuple.prefixItems[0]).toEqual({ const: '@functional-examples/javascript' });
  expect(jsTuple.prefixItems[1]).toEqual({ $ref: '#/$defs/functionalexamplesjavascriptOptions' });
  expect(jsTuple.minItems).toBe(2);
  expect(jsTuple.maxItems).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npx nx run functional-examples:test --testFile=merger.spec.ts`

Expected: FAIL with no tuple schemas found

**Step 3: Commit test**

```bash
git add packages/functional-examples/src/schema/merger.spec.ts
git commit -m "test: add test for tuple plugin references"
```

---

## Task 3: Add test for generic fallbacks

**Files:**
- Modify: `packages/functional-examples/src/schema/merger.spec.ts` (after previous test)

**Step 1: Write failing test for generic plugin fallbacks**

Add this test after the tuple plugin test:

```typescript
it('should include generic fallbacks for unknown plugins', () => {
  const schema = mergeConfigSchema({
    pluginSchemas: [
      { pluginName: '@functional-examples/javascript', options: '{"type":"object"}' },
    ],
  });

  const properties = schema.properties ?? {};
  const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
  const anyOf = pluginsSchema.items?.anyOf ?? [];

  // Should include generic string fallback
  const genericString = anyOf.find((item: any) =>
    item.type === 'string' && item.description?.includes('Unknown')
  );
  expect(genericString).toBeDefined();
  expect(genericString).toEqual({
    type: 'string',
    description: 'Unknown plugin package name',
  });

  // Should include generic tuple fallback
  const genericTuple = anyOf.find((item: any) =>
    item.type === 'array' &&
    item.prefixItems?.[0]?.type === 'string' &&
    item.prefixItems?.[1]?.type === 'object'
  );
  expect(genericTuple).toBeDefined();
  expect(genericTuple.prefixItems).toHaveLength(2);
  expect(genericTuple.minItems).toBe(1);
  expect(genericTuple.maxItems).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npx nx run functional-examples:test --testFile=merger.spec.ts`

Expected: FAIL with no generic fallback entries found

**Step 3: Commit test**

```bash
git add packages/functional-examples/src/schema/merger.spec.ts
git commit -m "test: add test for generic plugin fallbacks"
```

---

## Task 4: Implement plugin string and tuple support

**Files:**
- Modify: `packages/functional-examples/src/schema/merger.ts:97-122`

**Step 1: Update mergeConfigSchema to generate string and tuple schemas**

Replace the plugin ref generation loop (lines 97-122) with this implementation:

```typescript
for (const { pluginName, options: optionsSchema } of pluginSchemas) {
  if (!optionsSchema) continue;

  const defName = `${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Options`;

  try {
    const parsed = JSON.parse(optionsSchema) as JSONSchema;
    const defs = schema.$defs ?? {};
    defs[defName] = {
      ...parsed,
      description: `Options for ${pluginName} plugin`,
    };
    schema.$defs = defs;

    // 1. String format for this plugin
    pluginRefs.push({ const: pluginName });

    // 2. Tuple format for this plugin
    pluginRefs.push({
      type: 'array',
      prefixItems: [
        { const: pluginName },
        { $ref: `#/$defs/${defName}` },
      ],
      minItems: 2,
      maxItems: 2,
    });
  } catch {
    // Invalid JSON schema, skip
    console.warn(`Invalid options schema for plugin ${pluginName}`);
  }
}

// Add generic fallbacks for unknown plugins
pluginRefs.push(
  { type: 'string', description: 'Unknown plugin package name' },
  {
    type: 'array',
    description: 'Unknown plugin with options',
    prefixItems: [
      { type: 'string' },
      { type: 'object' },
    ],
    minItems: 1,
    maxItems: 2,
  }
);
```

**Step 2: Run tests to verify they pass**

Run: `npx nx run functional-examples:test --testFile=merger.spec.ts`

Expected: All tests PASS

**Step 3: Commit implementation**

```bash
git add packages/functional-examples/src/schema/merger.ts
git commit -m "feat: support string and tuple plugin references in generated schemas

- Generate const schemas for each plugin (string format)
- Generate tuple schemas with prefixItems (tuple format)
- Add generic fallbacks for unknown plugins
- Matches TypeScript PluginReference type exactly"
```

---

## Task 5: Test with real example

**Files:**
- Verify: `examples/test-plugin-example/functional-examples.config.json`

**Step 1: Regenerate schema in test-plugin-example**

Run: `cd examples/test-plugin-example && npx functional-examples generate`

Expected: Schema generated successfully

**Step 2: Verify generated schema structure**

```bash
cat examples/test-plugin-example/.functional-examples/schema.json | grep -A 20 '"plugins"'
```

Expected output should show:
- String consts for `@functional-examples/javascript` and `@functional-examples/test`
- Tuple schemas with prefixItems
- Generic fallbacks at the end

**Step 3: Verify existing config validates**

The config at `examples/test-plugin-example/functional-examples.config.json` already uses string format:
```json
"plugins": [
  "@functional-examples/javascript",
  "@functional-examples/test"
]
```

This should now validate correctly against the generated schema.

**Step 4: Commit regenerated schema**

```bash
git add examples/test-plugin-example/.functional-examples/
git commit -m "test: regenerate schema for test-plugin-example with string support"
```

---

## Task 6: Regenerate all example schemas

**Files:**
- Modify: All `examples/**/.functional-examples/schema.json`

**Step 1: Regenerate schemas for all examples**

Run from repo root:

```bash
for dir in examples/*/; do
  if [ -d "$dir" ] && [ "$(basename "$dir")" != "node_modules" ]; then
    echo "=== Generating in $dir ==="
    (cd "$dir" && npx functional-examples generate)
  fi
done
```

Expected: All schemas regenerate successfully

**Step 2: Verify at least one schema has the new structure**

```bash
cat examples/basic-usage/.functional-examples/schema.json | grep -A 5 '"const"'
```

Expected: Should show const entries for plugins

**Step 3: Commit all regenerated schemas**

```bash
git add examples/**/.functional-examples/schema.json
git commit -m "chore: regenerate all example schemas with string plugin support"
```

---

## Task 7: Update existing object-based test

**Files:**
- Modify: `packages/functional-examples/src/schema/merger.spec.ts:35-48`

**Step 1: Update test name and expectations**

The existing test "should reference plugin schemas in plugins array items" now needs updated expectations since we generate more entries per plugin:

```typescript
it('should reference plugin schemas in plugins array items', () => {
  const schema = mergeConfigSchema({
    pluginSchemas: [
      { pluginName: 'javascript', options: '{"type":"object"}' },
      { pluginName: 'yaml-manifest', options: '{"type":"object"}' },
    ],
  });

  // The plugins array should allow items matching any registered plugin
  const properties = schema.properties ?? {};
  const pluginsSchema = properties.plugins as { items?: { anyOf?: unknown[] } };
  expect(pluginsSchema.items?.anyOf).toBeDefined();

  // Each plugin with options generates 2 explicit schemas + 2 generic fallbacks
  // 2 plugins * 2 (string + tuple) + 2 fallbacks = 6
  expect(pluginsSchema.items?.anyOf?.length).toBe(6);
});
```

**Step 2: Run test to verify it passes**

Run: `npx nx run functional-examples:test --testFile=merger.spec.ts`

Expected: All tests PASS

**Step 3: Commit test update**

```bash
git add packages/functional-examples/src/schema/merger.spec.ts
git commit -m "test: update schema reference count expectations"
```

---

## Verification

**Run all tests:**
```bash
npx nx run functional-examples:test
```

Expected: All tests pass

**Check git status:**
```bash
git log --oneline -10
```

Expected commits:
1. test: update schema reference count expectations
2. chore: regenerate all example schemas with string plugin support
3. test: regenerate schema for test-plugin-example with string support
4. feat: support string and tuple plugin references in generated schemas
5. test: add test for generic plugin fallbacks
6. test: add test for tuple plugin references
7. test: add test for string plugin references

**Verify JSON config validates:**

Open `examples/test-plugin-example/functional-examples.config.json` in VS Code and verify:
- No schema validation errors
- Autocomplete suggests plugin names when typing in plugins array
- Tuple format `["plugin-name", { options }]` also validates

---

## Success Criteria

- ✅ All tests pass
- ✅ Generated schemas support string format: `"@functional-examples/javascript"`
- ✅ Generated schemas support tuple format: `["@functional-examples/javascript", { options }]`
- ✅ Generic fallbacks allow unknown plugins
- ✅ IDE autocomplete works for known plugins
- ✅ All example schemas regenerated
- ✅ Commits follow conventional format
