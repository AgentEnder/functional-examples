#!/usr/bin/env bash
# Demonstrates different output formats for scan results

# #_region scan
# Default scan output
npx functional-examples scan
# #_endregion scan

# #_region json
# JSON output format
npx functional-examples scan -f json
# #_endregion json

# #_region yaml
# YAML output format
npx functional-examples scan -f yaml
# #_endregion yaml
