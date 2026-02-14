#!/usr/bin/env bash
# Demonstrates scanning directory-based examples with YAML manifests

# #_region scan
# Scan for examples — yaml-manifest plugin auto-detected from deps
npx functional-examples scan
# #_endregion scan

# #_region json
# View detailed output as JSON
npx functional-examples scan -f json
# #_endregion json
