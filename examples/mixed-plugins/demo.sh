#!/usr/bin/env bash
# Demonstrates multiple plugins with path-based conflict resolution

# #_region scan
# Scan — plugins auto-detected, pathMappings resolve conflicts
npx functional-examples scan
# #_endregion scan

# #_region json
# View detailed output showing which extractor claimed each example
npx functional-examples scan -f json
# #_endregion json
