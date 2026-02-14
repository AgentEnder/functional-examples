#!/usr/bin/env bash
# Demonstrates generating documentation from scanned examples

cd "$(dirname "$0")"

# #_region generate
# Generate markdown documentation from all scanned examples
npx functional-examples documentation
# #_endregion generate
