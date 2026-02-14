# Plugin Authoring

Demonstrates building a custom plugin from scratch that supports INI-based metadata.

## What This Shows

- Implementing the full `Plugin` interface (name, extensions, extractor, fileContentsParsers)
- Creating a custom `Extractor` that discovers `meta.ini` files
- Creating a `FileContentsParser` that strips INI comments
- Registering the plugin in a TypeScript config file

## Running

```bash
# Scan for examples using the custom INI plugin
bash demo.sh
```

## Plugin Structure

The INI plugin (`src/ini-plugin.ts`) provides:

1. **Extractor** — scans for `meta.ini` files, parses INI key=value pairs, returns `Example` objects
2. **FileContentsParser** — strips INI comments (`;` and `#` lines) from `.ini` files
3. **Plugin** — bundles the extractor and parser with a name and extensions list
