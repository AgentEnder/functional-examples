#!/usr/bin/env bash
# Demonstrates scanning examples in a CI-ready project

cd "$(dirname "$0")"

# #_region scan
# Scan for examples — same command used in the GitHub Actions workflow
npx functional-examples scan
# #_endregion scan
