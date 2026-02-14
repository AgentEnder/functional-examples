#!/usr/bin/env bash
# Demonstrates metadata validation with JSON Schema

# #_region scan
# Scan with validation — missing required fields will be reported
npx functional-examples scan
# #_endregion scan

# #_region json
# View detailed validation results as JSON
npx functional-examples scan -f json
# #_endregion json
