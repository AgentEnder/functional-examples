/**
 * Language configuration for region markers
 */

import type { LanguageConfig } from './types.js';

/**
 * Comment syntax configuration for various programming languages.
 * Maps file extensions to their comment patterns.
 */
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  // JavaScript/TypeScript family
  js: { lineComment: '//', blockComment: ['/*', '*/'] },
  jsx: { lineComment: '//', blockComment: ['/*', '*/'] },
  ts: { lineComment: '//', blockComment: ['/*', '*/'] },
  tsx: { lineComment: '//', blockComment: ['/*', '*/'] },
  mjs: { lineComment: '//', blockComment: ['/*', '*/'] },
  cjs: { lineComment: '//', blockComment: ['/*', '*/'] },
  mts: { lineComment: '//', blockComment: ['/*', '*/'] },
  cts: { lineComment: '//', blockComment: ['/*', '*/'] },

  // C family
  c: { lineComment: '//', blockComment: ['/*', '*/'] },
  h: { lineComment: '//', blockComment: ['/*', '*/'] },
  cpp: { lineComment: '//', blockComment: ['/*', '*/'] },
  hpp: { lineComment: '//', blockComment: ['/*', '*/'] },
  cc: { lineComment: '//', blockComment: ['/*', '*/'] },
  cxx: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Java/Kotlin/Scala
  java: { lineComment: '//', blockComment: ['/*', '*/'] },
  kt: { lineComment: '//', blockComment: ['/*', '*/'] },
  kts: { lineComment: '//', blockComment: ['/*', '*/'] },
  scala: { lineComment: '//', blockComment: ['/*', '*/'] },
  groovy: { lineComment: '//', blockComment: ['/*', '*/'] },

  // C#/F#
  cs: { lineComment: '//', blockComment: ['/*', '*/'] },
  fs: { lineComment: '//', blockComment: ['(*', '*)'] },
  fsx: { lineComment: '//', blockComment: ['(*', '*)'] },

  // Go/Rust/Swift
  go: { lineComment: '//', blockComment: ['/*', '*/'] },
  rs: { lineComment: '//', blockComment: ['/*', '*/'] },
  swift: { lineComment: '//', blockComment: ['/*', '*/'] },

  // PHP
  php: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Python
  py: { lineComment: '#' },
  pyw: { lineComment: '#' },
  pyi: { lineComment: '#' },

  // Ruby
  rb: { lineComment: '#' },
  rake: { lineComment: '#' },
  gemspec: { lineComment: '#' },

  // Shell/Bash
  sh: { lineComment: '#' },
  bash: { lineComment: '#' },
  zsh: { lineComment: '#' },
  fish: { lineComment: '#' },

  // PowerShell
  ps1: { lineComment: '#', blockComment: ['<#', '#>'] },
  psm1: { lineComment: '#', blockComment: ['<#', '#>'] },

  // Perl
  pl: { lineComment: '#' },
  pm: { lineComment: '#' },

  // R
  r: { lineComment: '#' },
  R: { lineComment: '#' },

  // YAML/TOML
  yml: { lineComment: '#' },
  yaml: { lineComment: '#' },
  toml: { lineComment: '#' },

  // Config files
  ini: { lineComment: ';' },
  conf: { lineComment: '#' },
  cfg: { lineComment: '#' },

  // SQL
  sql: { lineComment: '--', blockComment: ['/*', '*/'] },

  // Lua
  lua: { lineComment: '--', blockComment: ['--[[', ']]'] },

  // Haskell
  hs: { lineComment: '--', blockComment: ['{-', '-}'] },
  lhs: { lineComment: '--', blockComment: ['{-', '-}'] },

  // Elm
  elm: { lineComment: '--', blockComment: ['{-', '-}'] },

  // HTML/XML
  html: { blockComment: ['<!--', '-->'] },
  htm: { blockComment: ['<!--', '-->'] },
  xml: { blockComment: ['<!--', '-->'] },
  xhtml: { blockComment: ['<!--', '-->'] },
  svg: { blockComment: ['<!--', '-->'] },
  vue: { blockComment: ['<!--', '-->'] },

  // CSS/SCSS/LESS
  css: { blockComment: ['/*', '*/'] },
  scss: { lineComment: '//', blockComment: ['/*', '*/'] },
  sass: { lineComment: '//', blockComment: ['/*', '*/'] },
  less: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Markdown (HTML comments)
  md: { blockComment: ['<!--', '-->'] },
  mdx: { blockComment: ['<!--', '-->'] },

  // Dockerfile
  dockerfile: { lineComment: '#' },

  // Makefile
  makefile: { lineComment: '#' },
  mk: { lineComment: '#' },

  // Terraform/HCL
  tf: { lineComment: '#', blockComment: ['/*', '*/'] },
  tfvars: { lineComment: '#', blockComment: ['/*', '*/'] },
  hcl: { lineComment: '#', blockComment: ['/*', '*/'] },

  // Nix
  nix: { lineComment: '#', blockComment: ['/*', '*/'] },

  // Zig
  zig: { lineComment: '//' },

  // V
  v: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Nim
  nim: { lineComment: '#', blockComment: ['#[', ']#'] },

  // Julia
  jl: { lineComment: '#', blockComment: ['#=', '=#'] },

  // Clojure
  clj: { lineComment: ';' },
  cljs: { lineComment: ';' },
  cljc: { lineComment: ';' },
  edn: { lineComment: ';' },

  // Lisp/Scheme
  lisp: { lineComment: ';' },
  el: { lineComment: ';' },
  scm: { lineComment: ';' },
  rkt: { lineComment: ';' },

  // OCaml
  ml: { blockComment: ['(*', '*)'] },
  mli: { blockComment: ['(*', '*)'] },

  // Erlang/Elixir
  erl: { lineComment: '%' },
  hrl: { lineComment: '%' },
  ex: { lineComment: '#' },
  exs: { lineComment: '#' },

  // Prolog
  pro: { lineComment: '%', blockComment: ['/*', '*/'] },
  // Note: .pl is typically Perl, not Prolog

  // Fortran
  f90: { lineComment: '!' },
  f95: { lineComment: '!' },
  f03: { lineComment: '!' },
  f08: { lineComment: '!' },
  for: { lineComment: '!' },

  // VHDL/Verilog
  vhd: { lineComment: '--' },
  vhdl: { lineComment: '--' },
  // Note: .v is used by both V lang (above) and Verilog - keeping V lang definition
  sv: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Assembly
  asm: { lineComment: ';' },
  s: { lineComment: ';' },

  // Batch
  bat: { lineComment: 'REM' },
  cmd: { lineComment: 'REM' },

  // AppleScript
  applescript: { lineComment: '--', blockComment: ['(*', '*)'] },

  // CoffeeScript
  coffee: { lineComment: '#', blockComment: ['###', '###'] },

  // Dart
  dart: { lineComment: '//', blockComment: ['/*', '*/'] },

  // GLSL/HLSL
  glsl: { lineComment: '//', blockComment: ['/*', '*/'] },
  hlsl: { lineComment: '//', blockComment: ['/*', '*/'] },
  vert: { lineComment: '//', blockComment: ['/*', '*/'] },
  frag: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Jsonnet
  jsonnet: { lineComment: '//', blockComment: ['/*', '*/'] },
  libsonnet: { lineComment: '//', blockComment: ['/*', '*/'] },

  // Starlark/Bazel
  bzl: { lineComment: '#' },
  bazel: { lineComment: '#' },
  BUILD: { lineComment: '#' },

  // Protobuf
  proto: { lineComment: '//', blockComment: ['/*', '*/'] },
};

/**
 * Get the language configuration for a file extension.
 * Falls back to JavaScript-style comments if unknown.
 */
export function getLanguageConfig(extension: string): LanguageConfig {
  // Normalize extension (remove leading dot, lowercase)
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return LANGUAGE_CONFIGS[normalized] ?? { lineComment: '//' };
}
