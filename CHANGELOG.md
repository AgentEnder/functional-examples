## 0.1.0 (2026-02-23)

### 🚀 Features

- support RegExp patterns in fileExtensionMap (string | RegExp)[] ([b92ae64](https://github.com/AgentEnder/functional-examples/commit/b92ae64))
- **core:** add DEFAULT_REGION_EXTENSION_MAP for common file extensions ([9f3e8b2](https://github.com/AgentEnder/functional-examples/commit/9f3e8b2))
- **core:** add extractRegionFromFileContent and createGenericRegionParser ([9981b19](https://github.com/AgentEnder/functional-examples/commit/9981b19))
- **core:** add region block to config schema, apply defaults in resolveConfig ([f98846e](https://github.com/AgentEnder/functional-examples/commit/f98846e))
- **core:** wire regionConfig into pipeline context and scanner ([bb8bc36](https://github.com/AgentEnder/functional-examples/commit/bb8bc36))
- **devkit:** add RegionConfig type, regionConfig to FileParseContext, region to Config ([9d8bb0a](https://github.com/AgentEnder/functional-examples/commit/9d8bb0a))
- **documentation:** add customHelpers to createGuideRenderer; dogfood with sourceRegion helper in docs ([c68f59a](https://github.com/AgentEnder/functional-examples/commit/c68f59a))
- **javascript:** set parsed content in extractor (strips frontmatter) ([d3ed68b](https://github.com/AgentEnder/functional-examples/commit/d3ed68b))
- **javascript:** remove region and frontmatter parsers (handled by core) ([ee5fd39](https://github.com/AgentEnder/functional-examples/commit/ee5fd39))
- **regions:** support hyphenated IDs and update default tags to #region/#endregion ([1280fad](https://github.com/AgentEnder/functional-examples/commit/1280fad))

### 🩹 Fixes

- update createInitialContext callers and fix non-null assertions in spec ([3ce88e3](https://github.com/AgentEnder/functional-examples/commit/3ce88e3))
- **devkit:** make ScannedExample.file() throw on missing file instead of returning undefined ([1fd4056](https://github.com/AgentEnder/functional-examples/commit/1fd4056))
- **repo:** correct snippets in files ([2405df0](https://github.com/AgentEnder/functional-examples/commit/2405df0))
- **repo:** point to build outputs directly instead of relying on pnpm link bin entries ([70264e4](https://github.com/AgentEnder/functional-examples/commit/70264e4))
- **tests:** use ExampleFile constructor in engine specs; add outDir to devkit tsconfig.spec ([c2625cd](https://github.com/AgentEnder/functional-examples/commit/c2625cd))
- **tests:** loosen performance thresholds for extended-iterable ([25707dd](https://github.com/AgentEnder/functional-examples/commit/25707dd))
- **vike-plugin-typedoc:** deduplicate prerender URLs and guard against duplicate invocations ([8dce371](https://github.com/AgentEnder/functional-examples/commit/8dce371))

### ❤️ Thank You

- Claude
- Craigory Coppola @AgentEnder

## 0.0.1 (2026-02-19)

### 🚀 Features

- export Plugin system types from main package ([ea2e7e5](https://github.com/AgentEnder/functional-examples/commit/ea2e7e5))
- export plugin system from main package ([91409c5](https://github.com/AgentEnder/functional-examples/commit/91409c5))
- finalize core package exports for plugin architecture ([4b0c2de](https://github.com/AgentEnder/functional-examples/commit/4b0c2de))
- export validation types from main package ([cf52d92](https://github.com/AgentEnder/functional-examples/commit/cf52d92))
- add config types and exports for schema generation ([2509c17](https://github.com/AgentEnder/functional-examples/commit/2509c17))
- ⚠️  implement candidate-based extraction architecture ([f42c01d](https://github.com/AgentEnder/functional-examples/commit/f42c01d))
- ⚠️  migrate yaml-manifest extractor to candidate-based ([7ca4dce](https://github.com/AgentEnder/functional-examples/commit/7ca4dce))
- ⚠️  migrate javascript extractor to candidate-based ([8663d4a](https://github.com/AgentEnder/functional-examples/commit/8663d4a))
- add test plugin to examples config ([02ba796](https://github.com/AgentEnder/functional-examples/commit/02ba796))
- add rehype-typedoc and vike-plugin-typedoc packages ([c95ded5](https://github.com/AgentEnder/functional-examples/commit/c95ded5))
- add typedoc extract-docs pipeline ([331e736](https://github.com/AgentEnder/functional-examples/commit/331e736))
- add hydrate-readmes script and README templates ([c5479c6](https://github.com/AgentEnder/functional-examples/commit/c5479c6))
- restructure examples for CLI-first workflow ([980fb97](https://github.com/AgentEnder/functional-examples/commit/980fb97))
- add universal metadata schema with base fields ([ad91620](https://github.com/AgentEnder/functional-examples/commit/ad91620))
- add .json extension support and JSON region parsing ([2ecdaf7](https://github.com/AgentEnder/functional-examples/commit/2ecdaf7))
- restructure test-plugin-example as meta-example ([ed6b303](https://github.com/AgentEnder/functional-examples/commit/ed6b303))
- add snapshot-testing, ci-integration, documentation-plugin, and plugin-authoring examples ([765eda0](https://github.com/AgentEnder/functional-examples/commit/765eda0))
- docs site infrastructure improvements ([696efc3](https://github.com/AgentEnder/functional-examples/commit/696efc3))
- add remark-directive to markdown pipelines ([aa66beb](https://github.com/AgentEnder/functional-examples/commit/aa66beb))
- add getting-started example and embed in docs ([5fad258](https://github.com/AgentEnder/functional-examples/commit/5fad258))
- add test-assertions example and embed in docs ([e70c679](https://github.com/AgentEnder/functional-examples/commit/e70c679))
- add region-markers and multi-plugin-config examples ([4bbefbe](https://github.com/AgentEnder/functional-examples/commit/4bbefbe))
- extend examples with regions for remaining doc code blocks ([887d1be](https://github.com/AgentEnder/functional-examples/commit/887d1be))
- support string and tuple plugin references in generated schemas ([e0c7cac](https://github.com/AgentEnder/functional-examples/commit/e0c7cac))
- add descriptions to string plugin schema entries ([a89a8ed](https://github.com/AgentEnder/functional-examples/commit/a89a8ed))
- add PluginOptionsRegistry for type-safe plugin references ([4777761](https://github.com/AgentEnder/functional-examples/commit/4777761))
- generate PluginOptionsRegistry augmentation in metadata.d.ts ([3f1c631](https://github.com/AgentEnder/functional-examples/commit/3f1c631))
- **cli:** add generate command for schema and type generation ([4dae84e](https://github.com/AgentEnder/functional-examples/commit/4dae84e))
- **cli:** add plugin commands loader with namespace resolution ([e78aa5b](https://github.com/AgentEnder/functional-examples/commit/e78aa5b))
- **cli:** wire plugin commands into main CLI entry ([3daf60a](https://github.com/AgentEnder/functional-examples/commit/3daf60a))
- **config:** integrate options validation into config resolution ([328ca15](https://github.com/AgentEnder/functional-examples/commit/328ca15))
- **core:** auto-detect plugins, pipeline hunk accumulation, and scanner fixes ([736cbd6](https://github.com/AgentEnder/functional-examples/commit/736cbd6))
- **devkit:** add shared plugin development kit package ([1691f87](https://github.com/AgentEnder/functional-examples/commit/1691f87))
- **devkit:** add PluginReference type and multi-parser plugin interface ([2eb5bd8](https://github.com/AgentEnder/functional-examples/commit/2eb5bd8))
- **docs-site:** add documentation website ([5092063](https://github.com/AgentEnder/functional-examples/commit/5092063))
- **docs-site:** integrate typedoc API documentation ([f0ff2c2](https://github.com/AgentEnder/functional-examples/commit/f0ff2c2))
- **docs-site:** adopt plugin prerendering and language class injection ([5d8d802](https://github.com/AgentEnder/functional-examples/commit/5d8d802))
- **docs-site:** wire up resolveSignature for typedoc directives ([16467a8](https://github.com/AgentEnder/functional-examples/commit/16467a8))
- **documentation:** add documentation generation plugin ([1ed6f73](https://github.com/AgentEnder/functional-examples/commit/1ed6f73))
- **e2e:** add end-to-end test infrastructure ([1d4b245](https://github.com/AgentEnder/functional-examples/commit/1d4b245))
- **examples:** add root config to dogfood functional-examples ([558369d](https://github.com/AgentEnder/functional-examples/commit/558369d))
- **examples:** add test plugin example ([cc4f0e0](https://github.com/AgentEnder/functional-examples/commit/cc4f0e0))
- **examples:** restructure examples as standalone packages ([1fa5497](https://github.com/AgentEnder/functional-examples/commit/1fa5497))
- **functional-examples:** make scan() generic over metadata type ([0d7c550](https://github.com/AgentEnder/functional-examples/commit/0d7c550))
- **javascript:** create JavaScript plugin package structure ([9fbea66](https://github.com/AgentEnder/functional-examples/commit/9fbea66))
- **javascript:** add frontmatter parser ([44279b5](https://github.com/AgentEnder/functional-examples/commit/44279b5))
- **javascript:** add single-file extractor ([2738cc9](https://github.com/AgentEnder/functional-examples/commit/2738cc9))
- **javascript:** add plugin entry point ([5791534](https://github.com/AgentEnder/functional-examples/commit/5791534))
- **javascript:** add schemas and validators to plugin ([22240a7](https://github.com/AgentEnder/functional-examples/commit/22240a7))
- **javascript:** add package.json multi-file example support ([fb4db8f](https://github.com/AgentEnder/functional-examples/commit/fb4db8f))
- **javascript:** multi-parser architecture, frontmatter hunks, and custom regions ([466738f](https://github.com/AgentEnder/functional-examples/commit/466738f))
- **plugins:** implement PluginRegistry for plugin management ([3e4cc80](https://github.com/AgentEnder/functional-examples/commit/3e4cc80))
- **plugins:** add validation and schema methods to PluginRegistry ([327c235](https://github.com/AgentEnder/functional-examples/commit/327c235))
- **plugins:** add validation runner functions ([ad6d01b](https://github.com/AgentEnder/functional-examples/commit/ad6d01b))
- **rehype-typedoc:** filter code block linking by language ([8e90f36](https://github.com/AgentEnder/functional-examples/commit/8e90f36))
- **rehype-typedoc:** migrate remarkCodeProps to directive-based syntax ([7f7df1a](https://github.com/AgentEnder/functional-examples/commit/7f7df1a))
- **scanner:** Add plugin support with backward compatible extractors ([bbc0974](https://github.com/AgentEnder/functional-examples/commit/bbc0974))
- **scanner:** integrate metadata validation into scan pipeline ([5e534e3](https://github.com/AgentEnder/functional-examples/commit/5e534e3))
- **schema:** add config and metadata schema merger utilities ([54ae8e6](https://github.com/AgentEnder/functional-examples/commit/54ae8e6))
- **schema:** add AJV-based config metadata validation ([6343c9d](https://github.com/AgentEnder/functional-examples/commit/6343c9d))
- **test:** create test plugin package structure ([6f29143](https://github.com/AgentEnder/functional-examples/commit/6f29143))
- **test:** add Zod schema for test metadata ([85f77b4](https://github.com/AgentEnder/functional-examples/commit/85f77b4))
- **test:** add reporter types and interface ([a0787e1](https://github.com/AgentEnder/functional-examples/commit/a0787e1))
- **test:** implement pretty reporter ([1f4c9f5](https://github.com/AgentEnder/functional-examples/commit/1f4c9f5))
- **test:** implement TAP reporter ([bc65547](https://github.com/AgentEnder/functional-examples/commit/bc65547))
- **test:** add reporter resolver with module path support ([de2c7e7](https://github.com/AgentEnder/functional-examples/commit/de2c7e7))
- **test:** implement test runner core with command execution ([dd6acb3](https://github.com/AgentEnder/functional-examples/commit/dd6acb3))
- **test:** add plugin options types ([a28f5a0](https://github.com/AgentEnder/functional-examples/commit/a28f5a0))
- **test:** implement test and list CLI commands ([dc758da](https://github.com/AgentEnder/functional-examples/commit/dc758da))
- **test:** create plugin factory and main exports ([9d5679b](https://github.com/AgentEnder/functional-examples/commit/9d5679b))
- **test:** add multi-step tests and filesystem assertions ([2654a2f](https://github.com/AgentEnder/functional-examples/commit/2654a2f))
- **test:** add snapshot assertions and test definitions in meta.yml ([57eea0d](https://github.com/AgentEnder/functional-examples/commit/57eea0d))
- **test:** add output snapshots, ANSI stripping, and TAP reporter ([2a40c89](https://github.com/AgentEnder/functional-examples/commit/2a40c89))
- **typegen:** support complex JSON Schema types in type generation ([1f29f15](https://github.com/AgentEnder/functional-examples/commit/1f29f15))
- **types:** add ValidationResult and extend Plugin with schemas/validators ([45eba71](https://github.com/AgentEnder/functional-examples/commit/45eba71))
- **types:** add commands property to Plugin interface ([acb7b0c](https://github.com/AgentEnder/functional-examples/commit/acb7b0c))
- **types:** add ExampleMetadata module augmentation support ([571ce3f](https://github.com/AgentEnder/functional-examples/commit/571ce3f))
- **vike-plugin-typedoc:** add baseUrl support and centralize prerendering ([0899233](https://github.com/AgentEnder/functional-examples/commit/0899233))
- **yaml-manifest:** support include globs and custom region tags ([0822ebc](https://github.com/AgentEnder/functional-examples/commit/0822ebc))

### 🩹 Fixes

- fix getting-started example frontmatter and config ([3a4ca4d](https://github.com/AgentEnder/functional-examples/commit/3a4ca4d))
- address code review findings ([01241ad](https://github.com/AgentEnder/functional-examples/commit/01241ad))
- add type assertions to tuple plugin test ([a71579f](https://github.com/AgentEnder/functional-examples/commit/a71579f))
- include plugins without options schema in generated schema ([610f03a](https://github.com/AgentEnder/functional-examples/commit/610f03a))
- update docs and ensure all guides render ([adedb71](https://github.com/AgentEnder/functional-examples/commit/adedb71))
- stop generating .d.ts and .tsbuildinfo files in src/ directories ([481de83](https://github.com/AgentEnder/functional-examples/commit/481de83))
- **extended-iterable:** use pipeline iterator in terminal operations and clean up unused classes ([5b8e963](https://github.com/AgentEnder/functional-examples/commit/5b8e963))
- **vike-plugin-typedoc:** handle undefined config.typedoc gracefully ([5aab229](https://github.com/AgentEnder/functional-examples/commit/5aab229))

### 🔥 Performance

- **core:** optimize ExtendedIterable with class-based iterators ([637b1ad](https://github.com/AgentEnder/functional-examples/commit/637b1ad))

### ⚠️  Breaking Changes

- migrate javascript extractor to candidate-based  ([8663d4a](https://github.com/AgentEnder/functional-examples/commit/8663d4a))
- migrate yaml-manifest extractor to candidate-based  ([7ca4dce](https://github.com/AgentEnder/functional-examples/commit/7ca4dce))
- implement candidate-based extraction architecture  ([f42c01d](https://github.com/AgentEnder/functional-examples/commit/f42c01d))
  Extractor interface changed from
    extract(rootPath: string, options?) to
    extract(candidates: Dirent[], options: ExtractorOptions)
  - Add candidate resolution utility using tinyglobby
  - Scanner now resolves include/exclude patterns before extraction
  - Smart default: uses 'examples/*' if examples dir exists, else '*'
  - Extractors receive pre-filtered Dirent[] candidates
  - ExtractorOptions.rootPath is now required (was optional include/exclude)

### ❤️ Thank You

- Claude
- Craigory Coppola @AgentEnder

## 0.0.0-alpha.5 (2026-02-18)

This was a version bump only, there were no code changes.

## 0.0.0-alpha.3 (2026-02-18)

### 🚀 Features

- add universal metadata schema with base fields ([ad91620](https://github.com/AgentEnder/functional-examples/commit/ad91620))
- add .json extension support and JSON region parsing ([2ecdaf7](https://github.com/AgentEnder/functional-examples/commit/2ecdaf7))
- restructure test-plugin-example as meta-example ([ed6b303](https://github.com/AgentEnder/functional-examples/commit/ed6b303))
- add snapshot-testing, ci-integration, documentation-plugin, and plugin-authoring examples ([765eda0](https://github.com/AgentEnder/functional-examples/commit/765eda0))
- docs site infrastructure improvements ([696efc3](https://github.com/AgentEnder/functional-examples/commit/696efc3))
- add remark-directive to markdown pipelines ([aa66beb](https://github.com/AgentEnder/functional-examples/commit/aa66beb))
- add getting-started example and embed in docs ([5fad258](https://github.com/AgentEnder/functional-examples/commit/5fad258))
- add test-assertions example and embed in docs ([e70c679](https://github.com/AgentEnder/functional-examples/commit/e70c679))
- add region-markers and multi-plugin-config examples ([4bbefbe](https://github.com/AgentEnder/functional-examples/commit/4bbefbe))
- extend examples with regions for remaining doc code blocks ([887d1be](https://github.com/AgentEnder/functional-examples/commit/887d1be))
- support string and tuple plugin references in generated schemas ([e0c7cac](https://github.com/AgentEnder/functional-examples/commit/e0c7cac))
- add descriptions to string plugin schema entries ([a89a8ed](https://github.com/AgentEnder/functional-examples/commit/a89a8ed))
- **docs-site:** wire up resolveSignature for typedoc directives ([16467a8](https://github.com/AgentEnder/functional-examples/commit/16467a8))
- **rehype-typedoc:** migrate remarkCodeProps to directive-based syntax ([7f7df1a](https://github.com/AgentEnder/functional-examples/commit/7f7df1a))

### 🩹 Fixes

- fix getting-started example frontmatter and config ([3a4ca4d](https://github.com/AgentEnder/functional-examples/commit/3a4ca4d))
- address code review findings ([01241ad](https://github.com/AgentEnder/functional-examples/commit/01241ad))
- add type assertions to tuple plugin test ([a71579f](https://github.com/AgentEnder/functional-examples/commit/a71579f))
- include plugins without options schema in generated schema ([610f03a](https://github.com/AgentEnder/functional-examples/commit/610f03a))
- update docs and ensure all guides render ([adedb71](https://github.com/AgentEnder/functional-examples/commit/adedb71))

### ❤️ Thank You

- Claude
- Craigory Coppola @AgentEnder

## 0.0.0-alpha.2 (2026-02-14)

### 🚀 Features

- add rehype-typedoc and vike-plugin-typedoc packages ([c95ded5](https://github.com/AgentEnder/functional-examples/commit/c95ded5))
- add typedoc extract-docs pipeline ([331e736](https://github.com/AgentEnder/functional-examples/commit/331e736))
- add hydrate-readmes script and README templates ([c5479c6](https://github.com/AgentEnder/functional-examples/commit/c5479c6))
- restructure examples for CLI-first workflow ([980fb97](https://github.com/AgentEnder/functional-examples/commit/980fb97))
- **core:** auto-detect plugins, pipeline hunk accumulation, and scanner fixes ([736cbd6](https://github.com/AgentEnder/functional-examples/commit/736cbd6))
- **devkit:** add PluginReference type and multi-parser plugin interface ([2eb5bd8](https://github.com/AgentEnder/functional-examples/commit/2eb5bd8))
- **docs-site:** integrate typedoc API documentation ([f0ff2c2](https://github.com/AgentEnder/functional-examples/commit/f0ff2c2))
- **docs-site:** adopt plugin prerendering and language class injection ([5d8d802](https://github.com/AgentEnder/functional-examples/commit/5d8d802))
- **functional-examples:** make scan() generic over metadata type ([0d7c550](https://github.com/AgentEnder/functional-examples/commit/0d7c550))
- **javascript:** multi-parser architecture, frontmatter hunks, and custom regions ([466738f](https://github.com/AgentEnder/functional-examples/commit/466738f))
- **rehype-typedoc:** filter code block linking by language ([8e90f36](https://github.com/AgentEnder/functional-examples/commit/8e90f36))
- **test:** add snapshot assertions and test definitions in meta.yml ([57eea0d](https://github.com/AgentEnder/functional-examples/commit/57eea0d))
- **vike-plugin-typedoc:** add baseUrl support and centralize prerendering ([0899233](https://github.com/AgentEnder/functional-examples/commit/0899233))
- **yaml-manifest:** support include globs and custom region tags ([0822ebc](https://github.com/AgentEnder/functional-examples/commit/0822ebc))

### ❤️ Thank You

- Claude
- Craigory Coppola @AgentEnder

## 0.0.0-alpha.1 (2026-02-10)

### 🚀 Features

- export Plugin system types from main package ([ea2e7e5](https://github.com/AgentEnder/functional-examples/commit/ea2e7e5))
- export plugin system from main package ([91409c5](https://github.com/AgentEnder/functional-examples/commit/91409c5))
- finalize core package exports for plugin architecture ([4b0c2de](https://github.com/AgentEnder/functional-examples/commit/4b0c2de))
- export validation types from main package ([cf52d92](https://github.com/AgentEnder/functional-examples/commit/cf52d92))
- add config types and exports for schema generation ([2509c17](https://github.com/AgentEnder/functional-examples/commit/2509c17))
- ⚠️  implement candidate-based extraction architecture ([f42c01d](https://github.com/AgentEnder/functional-examples/commit/f42c01d))
- ⚠️  migrate yaml-manifest extractor to candidate-based ([7ca4dce](https://github.com/AgentEnder/functional-examples/commit/7ca4dce))
- ⚠️  migrate javascript extractor to candidate-based ([8663d4a](https://github.com/AgentEnder/functional-examples/commit/8663d4a))
- add test plugin to examples config ([02ba796](https://github.com/AgentEnder/functional-examples/commit/02ba796))
- **cli:** add generate command for schema and type generation ([4dae84e](https://github.com/AgentEnder/functional-examples/commit/4dae84e))
- **cli:** add plugin commands loader with namespace resolution ([e78aa5b](https://github.com/AgentEnder/functional-examples/commit/e78aa5b))
- **cli:** wire plugin commands into main CLI entry ([3daf60a](https://github.com/AgentEnder/functional-examples/commit/3daf60a))
- **config:** integrate options validation into config resolution ([328ca15](https://github.com/AgentEnder/functional-examples/commit/328ca15))
- **devkit:** add shared plugin development kit package ([1691f87](https://github.com/AgentEnder/functional-examples/commit/1691f87))
- **docs-site:** add documentation website ([5092063](https://github.com/AgentEnder/functional-examples/commit/5092063))
- **documentation:** add documentation generation plugin ([1ed6f73](https://github.com/AgentEnder/functional-examples/commit/1ed6f73))
- **e2e:** add end-to-end test infrastructure ([1d4b245](https://github.com/AgentEnder/functional-examples/commit/1d4b245))
- **examples:** add root config to dogfood functional-examples ([558369d](https://github.com/AgentEnder/functional-examples/commit/558369d))
- **examples:** add test plugin example ([cc4f0e0](https://github.com/AgentEnder/functional-examples/commit/cc4f0e0))
- **examples:** restructure examples as standalone packages ([1fa5497](https://github.com/AgentEnder/functional-examples/commit/1fa5497))
- **javascript:** create JavaScript plugin package structure ([9fbea66](https://github.com/AgentEnder/functional-examples/commit/9fbea66))
- **javascript:** add frontmatter parser ([44279b5](https://github.com/AgentEnder/functional-examples/commit/44279b5))
- **javascript:** add single-file extractor ([2738cc9](https://github.com/AgentEnder/functional-examples/commit/2738cc9))
- **javascript:** add plugin entry point ([5791534](https://github.com/AgentEnder/functional-examples/commit/5791534))
- **javascript:** add schemas and validators to plugin ([22240a7](https://github.com/AgentEnder/functional-examples/commit/22240a7))
- **javascript:** add package.json multi-file example support ([fb4db8f](https://github.com/AgentEnder/functional-examples/commit/fb4db8f))
- **plugins:** implement PluginRegistry for plugin management ([3e4cc80](https://github.com/AgentEnder/functional-examples/commit/3e4cc80))
- **plugins:** add validation and schema methods to PluginRegistry ([327c235](https://github.com/AgentEnder/functional-examples/commit/327c235))
- **plugins:** add validation runner functions ([ad6d01b](https://github.com/AgentEnder/functional-examples/commit/ad6d01b))
- **scanner:** Add plugin support with backward compatible extractors ([bbc0974](https://github.com/AgentEnder/functional-examples/commit/bbc0974))
- **scanner:** integrate metadata validation into scan pipeline ([5e534e3](https://github.com/AgentEnder/functional-examples/commit/5e534e3))
- **schema:** add config and metadata schema merger utilities ([54ae8e6](https://github.com/AgentEnder/functional-examples/commit/54ae8e6))
- **schema:** add AJV-based config metadata validation ([6343c9d](https://github.com/AgentEnder/functional-examples/commit/6343c9d))
- **test:** create test plugin package structure ([6f29143](https://github.com/AgentEnder/functional-examples/commit/6f29143))
- **test:** add Zod schema for test metadata ([85f77b4](https://github.com/AgentEnder/functional-examples/commit/85f77b4))
- **test:** add reporter types and interface ([a0787e1](https://github.com/AgentEnder/functional-examples/commit/a0787e1))
- **test:** implement pretty reporter ([1f4c9f5](https://github.com/AgentEnder/functional-examples/commit/1f4c9f5))
- **test:** implement TAP reporter ([bc65547](https://github.com/AgentEnder/functional-examples/commit/bc65547))
- **test:** add reporter resolver with module path support ([de2c7e7](https://github.com/AgentEnder/functional-examples/commit/de2c7e7))
- **test:** implement test runner core with command execution ([dd6acb3](https://github.com/AgentEnder/functional-examples/commit/dd6acb3))
- **test:** add plugin options types ([a28f5a0](https://github.com/AgentEnder/functional-examples/commit/a28f5a0))
- **test:** implement test and list CLI commands ([dc758da](https://github.com/AgentEnder/functional-examples/commit/dc758da))
- **test:** create plugin factory and main exports ([9d5679b](https://github.com/AgentEnder/functional-examples/commit/9d5679b))
- **test:** add multi-step tests and filesystem assertions ([2654a2f](https://github.com/AgentEnder/functional-examples/commit/2654a2f))
- **typegen:** support complex JSON Schema types in type generation ([1f29f15](https://github.com/AgentEnder/functional-examples/commit/1f29f15))
- **types:** add ValidationResult and extend Plugin with schemas/validators ([45eba71](https://github.com/AgentEnder/functional-examples/commit/45eba71))
- **types:** add commands property to Plugin interface ([acb7b0c](https://github.com/AgentEnder/functional-examples/commit/acb7b0c))
- **types:** add ExampleMetadata module augmentation support ([571ce3f](https://github.com/AgentEnder/functional-examples/commit/571ce3f))

### 🩹 Fixes

- **extended-iterable:** use pipeline iterator in terminal operations and clean up unused classes ([5b8e963](https://github.com/AgentEnder/functional-examples/commit/5b8e963))

### 🔥 Performance

- **core:** optimize ExtendedIterable with class-based iterators ([637b1ad](https://github.com/AgentEnder/functional-examples/commit/637b1ad))

### ⚠️  Breaking Changes

- migrate javascript extractor to candidate-based  ([8663d4a](https://github.com/AgentEnder/functional-examples/commit/8663d4a))
- migrate yaml-manifest extractor to candidate-based  ([7ca4dce](https://github.com/AgentEnder/functional-examples/commit/7ca4dce))
- implement candidate-based extraction architecture  ([f42c01d](https://github.com/AgentEnder/functional-examples/commit/f42c01d))
  Extractor interface changed from
    extract(rootPath: string, options?) to
    extract(candidates: Dirent[], options: ExtractorOptions)
  - Add candidate resolution utility using tinyglobby
  - Scanner now resolves include/exclude patterns before extraction
  - Smart default: uses 'examples/*' if examples dir exists, else '*'
  - Extractors receive pre-filtered Dirent[] candidates
  - ExtractorOptions.rootPath is now required (was optional include/exclude)

### ❤️ Thank You

- Claude
- Craigory Coppola @AgentEnder