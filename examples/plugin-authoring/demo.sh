#!/usr/bin/env bash
# Demonstrates scanning with a custom INI plugin

cd "$(dirname "$0")"

# #_region scan
# Scan using the custom INI plugin — registered in functional-examples.config.ts
npx functional-examples scan
# #_endregion scan
