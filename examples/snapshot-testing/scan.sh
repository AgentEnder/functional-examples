#!/usr/bin/env bash
# Scan for examples and save output to a file for snapshot comparison

cd "$(dirname "$0")"

# #_region scan
# Run the scan and capture output, stripping the timing line (non-deterministic)
npx functional-examples scan | sed '/^Scan completed in/d' > output.txt
# #_endregion scan
