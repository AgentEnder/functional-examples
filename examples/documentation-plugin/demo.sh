#!/usr/bin/env bash
# Demonstrates the documentation plugin scanning examples

cd "$(dirname "$0")"

# #_region scan
# Scan for examples — documentation plugin registered alongside JavaScript plugin
npx functional-examples scan
# #_endregion scan
