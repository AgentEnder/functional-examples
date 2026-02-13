#!/usr/bin/env bash
# Demonstrates CLI usage of functional-examples

# #_region scan
# Scan for examples and display results
npx functional-examples scan .
# #_endregion scan

# #_region json
# Output scan results as JSON
npx functional-examples scan . -f json
# #_endregion json
