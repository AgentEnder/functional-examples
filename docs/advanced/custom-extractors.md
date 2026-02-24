---
title: "Custom Extractors"
description: "Build custom extractors to support alternative metadata formats like TOML, INI, or any structured file."
nav:
  order: 1
---

# Custom Extractors

When the built-in plugins don't support your metadata format, you can write a custom extractor. An extractor receives file candidates and returns discovered examples.

## Extractor Interface

::typedoc{symbol="Extractor" pkg="devkit"}

**Inputs:**
- `candidates` — `Dirent[]` entries (files and directories) matching the scan config
- `options` — optional `ExtractorOptions` with `rootPath`, `exclude[]`, and `signal` for cancellation

**Output:**
::typedoc{symbol="ExtractorResult" pkg="devkit"}

## Step-by-Step Walkthrough

Here's a complete custom extractor that reads TOML metadata files:

<%= example('custom-extractor').file('toml-extractor.ts') %>

### Key Concepts

1. **Scan candidates** — The extractor receives pre-filtered file entries. Iterate them to find your metadata files (e.g., `meta.toml`).

2. **Claim files** — Add every file your extractor "owns" to the `claimedFiles` set. This prevents other extractors from processing the same files.

3. **Return errors gracefully** — For recoverable issues (malformed metadata, missing fields), push to the `errors` array instead of throwing. The scanner collects all errors across extractors.

4. **Set `extractorName`** — Each example includes its `extractorName` so results show which extractor produced it.

## Registering a Custom Extractor

### Via Programmatic Scan

<%= example('custom-extractor').file('scan.ts') %>

### Via Config Plugin

Wrap your extractor in a plugin object to register it via config:

<%= example('custom-extractor').region('plugin-config') %>

## Error Handling

- **Recoverable errors** → push to `errors[]` array (scanner aggregates them)
- **Unrecoverable failures** → throw an error (scanner catches and reports it)
- Always validate required fields (`id`, `title`) before creating an `Example`

## Testing Custom Extractors

Write tests that verify your extractor:
1. Finds examples from valid metadata files
2. Returns errors for malformed metadata
3. Claims the correct files
4. Handles empty candidate lists gracefully

**See also:** [Plugin Authoring](../plugin-authoring) for building a full plugin with extractors, parsers, and more.
