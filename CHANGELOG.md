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