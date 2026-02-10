---
title: "Why functional-examples"
description: "The problem functional-examples solves, its design philosophy, and how it treats examples as first-class project artifacts."
nav:
  section: "Guides"
  order: 2
---

# Why functional-examples

Code examples rot. They drift out of sync with the APIs they document, break silently, and nobody notices until a user files a bug. functional-examples exists to fix this.

## The Problem

Most documentation workflows treat examples as second-class content:

- **Copy-pasted snippets** in markdown files have no connection to real code. An API rename breaks them silently.
- **Screenshots and pseudocode** can't be tested or type-checked.
- **Entire demo repos** are hard to maintain — they rot even faster than docs because nobody runs CI on them.

The common thread: examples live *outside* the normal development workflow, so they don't benefit from the tools that keep production code healthy.

## The Solution

functional-examples treats code examples as **first-class project artifacts** — scannable, testable, and validatable, just like the rest of your codebase.

The core idea is simple:

1. **Examples live as real code** — actual `.ts`, `.js`, or other source files that your editor understands, your linter checks, and your CI can run.
2. **Metadata is co-located** — each example carries its own title, description, tags, and custom fields, either as frontmatter or in a manifest file.
3. **A scanner extracts structure** — plugins walk your project tree and produce a uniform `Example` shape, regardless of the source format.
4. **Tools operate on the uniform shape** — generate docs, run tests, validate metadata, build galleries — all from the same scan result.

## Design Principles

### Language-Agnostic Core

The scanner and plugin system are format-neutral. The JavaScript plugin handles `.ts`/`.js` frontmatter, the YAML manifest plugin handles `meta.yml` directories, and you can write custom extractors for TOML, JSON, or any other format. The core never assumes a specific language.

### Plugins Over Configuration

Rather than a single monolithic config, functionality is composed from plugins. Each plugin can provide extractors, validators, schemas, commands, and more. You only install what you need.

### Examples Are Testable

Because examples are real files, you can run them. The `@functional-examples/test` plugin lets you declare assertions in `package.json` — expected exit codes, stdout patterns — and run them in CI alongside your unit tests.

### Single Source of Truth

Instead of maintaining examples in both source code and documentation, you write them once. The documentation plugin can pull live code into guides using template references like `<\%= example('basic-usage').file('scan.ts') \%>`, so docs always reflect the actual code.

## When to Use functional-examples

functional-examples is a good fit when:

- You maintain a **library or framework** with code examples in docs
- You build **tutorials or courses** with runnable code
- You have a **monorepo** with shared example projects
- You want to **test that examples actually work** in CI
- You need **metadata validation** to enforce standards across examples

It's less useful for one-off scripts or projects where examples are informal and don't need structure.
