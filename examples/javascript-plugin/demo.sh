#!/usr/bin/env bash
# Demonstrates JavaScript plugin with frontmatter and region markers

# #_region scan
# Scan for examples using the JavaScript plugin
npx functional-examples scan .
# #_endregion scan

# #_region json
# View scan results as JSON — includes regions and frontmatter metadata
npx functional-examples scan . -f json
# #_endregion json
