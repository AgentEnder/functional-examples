# AI Context Folder

This folder contains context and guidance for AI agents working on the functional-examples project.

## Contents

- **plans/**: High-level implementation plans outlining WHAT to build and WHY
- **design-decisions/**: Architecture Decision Records (ADRs) documenting key design choices
- **implementation/**: Concrete implementation specifications covering HOW to build it

## Workflow Overview

The AI workflow follows a clear separation between **planning** and **implementation**:

```
Research & Planning          →          Implementation
(What & Why)                          (How)

    .ai/plans/                  →      .ai/implementation/
   - Consumer workflows                  - Technical specifications
   - Edge cases                          - File-by-file breakdowns
   - Success criteria                    - Concrete implementation steps
   - Guidance, not code                  - Executable specifications
```

## Project Overview

**functional-examples** is a language-agnostic library for treating code examples as first-class citizens. It extracts the "examples as functional code" pattern from isolated-workers, cli-forge, and flexibench into a reusable library.

### Key Features

- **Pluggable metadata extraction**: YAML frontmatter and meta.yml built-in
- **Language-aware region parsing**: Extracts code regions with comment-style detection
- **Flexible scanning**: Directory-based and file-based example discovery
- **Type-safe API**: Full TypeScript support with generic metadata types

## Key Principles

1. **Plans are guidance**: They set direction but don't dictate implementation
2. **Implementation is concrete**: It specifies exactly what to build
3. **Keep them separate**: Don't mix planning details with implementation files
4. **Status matters**: Keep plan status accurate for visibility
5. **Reference liberally**: Link between docs to maintain context

## Source Material

This project extracts patterns from:
- **isolated-workers**: `docs-site/server/utils/examples.ts`, `docs-site/server/utils/regions.ts`
- **cli-forge**: `tools/scripts/collect-examples.ts`
- **flexibench**: Similar YAML frontmatter pattern
