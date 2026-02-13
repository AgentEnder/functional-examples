#!/usr/bin/env bash
# Demonstrates a custom TOML-based extractor

# #_region scan
# Run the custom scan script
npx tsx scan.ts
# #_endregion scan

# #_region json
# Output as JSON
npx tsx scan.ts --json
# #_endregion json
