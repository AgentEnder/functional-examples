import type {
  Example,
  Extractor,
  ExtractorError,
  ExtractorOptions,
  ExtractorResult,
} from '@functional-examples/devkit';
import {
  createMatcher,
  ExampleFile,
  glob,
  parseJson,
  parseYaml,
} from '@functional-examples/devkit';
import dependencyTree from 'dependency-tree';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const EXTRACTOR_NAME = 'javascript-extractor';

/** Default patterns to exclude from file scanning */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
];

/** Default directories to skip when processing directory candidates */
const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
]);

/** File extensions to scan for JavaScript/TypeScript examples */
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
  '**/*.mts',
  '**/*.cts',
];

/** File extensions this extractor handles */
const FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
];

/** Pattern matching line comment frontmatter start: // --- */
const LINE_COMMENT_START = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment frontmatter end: // --- */
const LINE_COMMENT_END = /^[ \t]*\/\/\s*---\s*$/;
/** Pattern matching line comment content: // <content> */
const LINE_COMMENT_CONTENT = /^[ \t]*\/\/\s?(.*)$/;

/** Pattern matching block comment frontmatter start: /* --- */
const BLOCK_COMMENT_START = /^[ \t]*\/\*\s*---\s*$/;
/** Pattern matching block comment frontmatter end: --- */
const BLOCK_COMMENT_END = /^[ \t]*---\s*\*\/\s*$/;

interface FrontmatterResult {
  /** Parsed YAML metadata */
  metadata: Record<string, unknown>;
  /** 0-indexed line number of the last frontmatter line */
  endLine: number;
}

/**
 * Try to extract line comment style frontmatter from the start of the file.
 */
async function extractLineCommentFrontmatter(
  lines: string[]
): Promise<FrontmatterResult | null> {
  if (lines.length < 2) return null;

  if (!LINE_COMMENT_START.test(lines[0])) {
    return null;
  }

  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (LINE_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    const match = line.match(LINE_COMMENT_CONTENT);
    if (match) {
      yamlLines.push(match[1]);
    } else {
      return null;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? ((await parseYaml(yamlContent)) as Record<string, unknown>) ?? {}
    : {};

  return { metadata, endLine: endIndex };
}

/**
 * Try to extract block comment style frontmatter from the start of the file.
 */
async function extractBlockCommentFrontmatter(
  lines: string[]
): Promise<FrontmatterResult | null> {
  if (lines.length < 2) return null;

  if (!BLOCK_COMMENT_START.test(lines[0])) {
    return null;
  }

  const yamlLines: string[] = [];
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (BLOCK_COMMENT_END.test(line)) {
      endIndex = i;
      break;
    }

    yamlLines.push(line);
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlContent = yamlLines.join('\n');
  const metadata = yamlContent.trim()
    ? ((await parseYaml(yamlContent)) as Record<string, unknown>) ?? {}
    : {};

  return { metadata, endLine: endIndex };
}

/**
 * Extract frontmatter from file content.
 */
async function extractFrontmatter(
  content: string
): Promise<FrontmatterResult | null> {
  const lines = content.split('\n');

  return (
    (await extractLineCommentFrontmatter(lines)) ??
    (await extractBlockCommentFrontmatter(lines))
  );
}

/**
 * Check if metadata has valid required fields (id and title as strings).
 */
function hasValidMetadata(
  metadata: Record<string, unknown>
): metadata is Record<string, unknown> & { id: string; title: string } {
  return (
    typeof metadata.id === 'string' &&
    metadata.id.length > 0 &&
    typeof metadata.title === 'string' &&
    metadata.title.length > 0
  );
}

/**
 * Parsed package.json structure
 */
interface PackageJson {
  name?: string;
  description?: string;
  keywords?: string[];
  main?: string;
  module?: string;
  types?: string;
  exports?: PackageExports;
  files?: string[];
  'functional-examples'?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Represents the exports field which can be various formats
 */
type PackageExports =
  | string
  | { [key: string]: PackageExports }
  | null
  | undefined;

/**
 * Strip npm scope from package name.
 * @example "@examples/foo" -> "foo"
 * @example "my-package" -> "my-package"
 */
function stripScope(name: string): string {
  if (name.startsWith('@')) {
    const slashIndex = name.indexOf('/');
    if (slashIndex !== -1) {
      return name.slice(slashIndex + 1);
    }
  }
  return name;
}

/**
 * Recursively extract all file paths from exports field.
 * Handles string, object with conditions, and nested export maps.
 */
function extractExportPaths(exports: PackageExports): string[] {
  if (!exports) {
    return [];
  }

  if (typeof exports === 'string') {
    return [exports];
  }

  if (typeof exports === 'object') {
    const paths: string[] = [];
    for (const value of Object.values(exports)) {
      paths.push(...extractExportPaths(value as PackageExports));
    }
    return paths;
  }

  return [];
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Read and parse a package.json file.
 * Returns the parsed package, a parse error, or null if the file can't be read.
 */
async function readPackageJson(
  packageJsonPath: string
): Promise<{ pkg: PackageJson } | { error: string } | null> {
  let content: string;
  try {
    content = await fs.readFile(packageJsonPath, 'utf-8');
  } catch {
    return null;
  }

  try {
    return { pkg: (await parseJson(content, packageJsonPath)) as PackageJson };
  } catch (e) {
    return {
      error: `Failed to parse package.json: ${(e as Error).message}`,
    };
  }
}

/**
 * Strip the functional-examples key from package.json content for output.
 */
function stripFunctionalExamplesKey(packageJsonContent: string): string {
  try {
    const pkg = JSON.parse(packageJsonContent) as Record<string, unknown>;
    delete pkg['functional-examples'];
    return JSON.stringify(pkg, null, 2);
  } catch {
    return packageJsonContent;
  }
}

/**
 * Dependency tree node type from dependency-tree package.
 * Can be a string (leaf) or an object with nested dependencies.
 */
type DependencyTreeNode = string | { [key: string]: DependencyTreeNode };

/**
 * Use dependency-tree to trace imports from an entry file.
 * Returns absolute paths of all traced dependencies within the example directory.
 */
function traceDependencies(entryPath: string, exampleDir: string): string[] {
  try {
    const tree = dependencyTree({
      filename: entryPath,
      directory: exampleDir,
      nodeModulesConfig: {
        // Don't trace into node_modules
        entry: 'module',
      },
    }) as DependencyTreeNode;

    // Flatten the dependency tree to get all unique file paths
    // Only include files within the example directory
    const files = new Set<string>();

    function collectFiles(node: DependencyTreeNode) {
      if (typeof node === 'string') {
        // Only add files within the example directory
        if (node.startsWith(exampleDir) && !node.includes('node_modules')) {
          files.add(node);
        }
        return;
      }

      for (const [filePath, deps] of Object.entries(node)) {
        // Only add files within the example directory
        if (
          filePath &&
          typeof filePath === 'string' &&
          filePath.startsWith(exampleDir) &&
          !filePath.includes('node_modules')
        ) {
          files.add(filePath);
        }
        if (deps) {
          collectFiles(deps);
        }
      }
    }

    collectFiles(tree);
    return Array.from(files);
  } catch {
    // If dependency tracing fails, just return the entry file
    return [entryPath];
  }
}

/**
 * Collect files for a multi-file package example.
 */
async function collectPackageFiles(
  exampleDir: string,
  pkg: PackageJson,
  options: ExtractorOptions
): Promise<{ files: string[]; error?: string }> {
  const collectedFiles = new Set<string>();
  const packageJsonPath = path.join(exampleDir, 'package.json');

  // Always include package.json
  collectedFiles.add(packageJsonPath);

  // Always include README.md if it exists
  for (const readmeName of ['README.md', 'README', 'readme.md']) {
    const readmePath = path.join(exampleDir, readmeName);
    if (await fileExists(readmePath)) {
      collectedFiles.add(readmePath);
      break;
    }
  }

  // Collect entry points to trace
  const entryPoints: string[] = [];

  // Add main field
  if (pkg.main) {
    const mainPath = path.resolve(exampleDir, pkg.main);
    if (await fileExists(mainPath)) {
      entryPoints.push(mainPath);
    }
  }

  // Add module field
  if (pkg.module) {
    const modulePath = path.resolve(exampleDir, pkg.module);
    if (await fileExists(modulePath)) {
      entryPoints.push(modulePath);
    }
  }

  // Add types field
  if (pkg.types) {
    const typesPath = path.resolve(exampleDir, pkg.types);
    if (await fileExists(typesPath)) {
      entryPoints.push(typesPath);
    }
  }

  // Add exports field paths
  if (pkg.exports) {
    const exportPaths = extractExportPaths(pkg.exports);
    for (const exportPath of exportPaths) {
      if (exportPath.startsWith('.')) {
        const resolvedPath = path.resolve(exampleDir, exportPath);
        if (await fileExists(resolvedPath)) {
          entryPoints.push(resolvedPath);
        }
      }
    }
  }

  // Trace dependencies from all entry points
  for (const entryPath of entryPoints) {
    const tracedFiles = traceDependencies(entryPath, exampleDir);
    for (const file of tracedFiles) {
      collectedFiles.add(file);
    }
  }

  // Include files from files array using fast-glob
  if (pkg.files && pkg.files.length > 0) {
    try {
      const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(options.exclude ?? []),
      ];
      const filesFromGlob = await glob(pkg.files, {
        cwd: exampleDir,
        absolute: true,
        ignore: excludePatterns,
        onlyFiles: true,
      });
      for (const file of filesFromGlob) {
        collectedFiles.add(file);
      }
    } catch {
      // Ignore glob errors
    }
  }

  // Check if we have any files besides package.json and README
  const sourceFiles = Array.from(collectedFiles).filter(
    (f) => !f.endsWith('package.json') && !f.toLowerCase().includes('readme')
  );

  if (
    sourceFiles.length === 0 &&
    entryPoints.length === 0 &&
    (!pkg.files || pkg.files.length === 0)
  ) {
    return {
      files: [],
      error:
        'No files could be determined for example. Add main, module, exports, or files field to package.json.',
    };
  }

  return { files: Array.from(collectedFiles) };
}

/**
 * Extract metadata from a package.json file per the design doc.
 */
function extractPackageMetadata(pkg: PackageJson): {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  metadata: Record<string, unknown>;
} | null {
  // name field is required
  if (!pkg.name || typeof pkg.name !== 'string') {
    return null;
  }

  const functionalExamples = pkg['functional-examples'] ?? {};
  const { title: feTitle, ...restFunctionalExamples } =
    functionalExamples as Record<string, unknown>;

  // Strip scope from name for id
  const id = stripScope(pkg.name);

  // Title: functional-examples.title overrides, fallback to name
  const title = typeof feTitle === 'string' ? feTitle : id;

  // Description: direct from package.json
  const description =
    typeof pkg.description === 'string' ? pkg.description : undefined;

  // Tags: from keywords array
  const tags = Array.isArray(pkg.keywords)
    ? pkg.keywords.filter((k): k is string => typeof k === 'string')
    : undefined;

  // Metadata: spread remaining functional-examples fields
  const metadata: Record<string, unknown> = { ...restFunctionalExamples };

  return {
    id,
    title,
    description,
    tags,
    metadata,
  };
}

/**
 * Create a JavaScript/TypeScript extractor.
 *
 * This extractor:
 * - Receives pre-filtered candidates (files and directories)
 * - For directories with package.json: treats as multi-file package example
 * - For files with frontmatter: treats as single-file example
 * - Extracts metadata from package.json or frontmatter
 * - Loads raw content into ExampleFile
 * - Respects exclude patterns (default: node_modules, .git, dist, build)
 * - Tracks claimed files for conflict detection
 */
export function createJavaScriptExtractor(): Extractor {
  async function tryExtractFromFile(
    absolutePath: string,
    rootPath: string
  ): Promise<Example | null> {
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      return null;
    }

    const frontmatter = await extractFrontmatter(content);
    if (!frontmatter || !hasValidMetadata(frontmatter.metadata)) {
      return null;
    }

    const { id, title, description, ...restMetadata } = frontmatter.metadata;
    const relativePath = path.relative(rootPath, absolutePath);
    const lines = content.split('\n');
    const parsed = lines.slice(frontmatter.endLine + 1).join('\n').trimStart();

    return {
      id,
      title,
      description: typeof description === 'string' ? description : undefined,
      rootPath: absolutePath,
      files: [new ExampleFile({ absolutePath, relativePath, raw: content, parsed })],
      metadata: restMetadata,
      extractorName: EXTRACTOR_NAME,
    };
  }

  async function tryExtractFromPackageJson(
    packageJsonPath: string,
    options: ExtractorOptions
  ): Promise<
    { example: Example; files: string[] } | { error: ExtractorError } | null
  > {
    const exampleDir = path.dirname(packageJsonPath);
    const readResult = await readPackageJson(packageJsonPath);

    if (!readResult) {
      return null;
    }

    if ('error' in readResult) {
      return {
        error: {
          path: packageJsonPath,
          message: readResult.error,
        },
      };
    }

    const pkg = readResult.pkg;

    const extracted = extractPackageMetadata(pkg);
    if (!extracted) {
      // No valid name field - not a valid package example
      return null;
    }

    const { id, title, description, tags, metadata } = extracted;

    // Collect files for this package example
    const { files: filePaths, error: collectError } = await collectPackageFiles(
      exampleDir,
      pkg,
      options
    );

    if (collectError) {
      return {
        error: {
          path: packageJsonPath,
          message: collectError,
        },
      };
    }

    // Build ExampleFile array
    const exampleFiles: ExampleFile[] = [];
    for (const filePath of filePaths) {
      try {
        let raw = await fs.readFile(filePath, 'utf-8');

        // Strip functional-examples key from package.json
        if (filePath.endsWith('package.json')) {
          raw = stripFunctionalExamplesKey(raw);
        }

        const relativePath = path.relative(exampleDir, filePath);
        exampleFiles.push(
          new ExampleFile({ absolutePath: filePath, relativePath, raw })
        );
      } catch {
        // Skip files that can't be read
      }
    }

    // Include tags in metadata if present
    const finalMetadata: Record<string, unknown> = { ...metadata };
    if (tags && tags.length > 0) {
      finalMetadata.tags = tags;
    }

    const example: Example = {
      id,
      title,
      description,
      rootPath: exampleDir,
      files: exampleFiles,
      metadata: finalMetadata,
      extractorName: EXTRACTOR_NAME,
    };

    return { example, files: filePaths };
  }

  return {
    name: EXTRACTOR_NAME,

    async extract(
      candidates: Dirent[],
      options: ExtractorOptions
    ): Promise<ExtractorResult> {
      const examples: Example[] = [];
      const claimedFiles = new Set<string>();
      const errors: ExtractorError[] = [];

      for (const candidate of candidates) {
        if (options.signal?.aborted) break;

        const fullPath = path.join(candidate.parentPath, candidate.name);

        // Handle file candidates
        if (candidate.isFile()) {
          // Check if it's a package.json file - resolve to parent directory
          if (candidate.name === 'package.json') {
            const result = await tryExtractFromPackageJson(fullPath, options);

            if (result) {
              if ('error' in result) {
                errors.push(result.error);
              } else {
                examples.push(result.example);
                for (const file of result.files) {
                  claimedFiles.add(file);
                }
              }
            }
            continue;
          }

          // Handle regular JS/TS files with frontmatter
          const ext = path.extname(candidate.name);
          if (!FILE_EXTENSIONS.includes(ext)) continue;

          const example = await tryExtractFromFile(fullPath, options.rootPath);
          if (example) {
            examples.push(example);
            claimedFiles.add(fullPath);
          }
          continue;
        }

        // Handle directory candidates
        if (candidate.isDirectory()) {
          // Skip excluded directories (default ones)
          if (DEFAULT_EXCLUDED_DIRS.has(candidate.name)) {
            continue;
          }

          // Skip directories matching custom exclude patterns
          const excludePatterns = options.exclude ?? [];
          const relativeDirPath = path.relative(options.rootPath, fullPath);
          const pathsToCheck = [
            candidate.name,
            relativeDirPath,
            `${relativeDirPath}/`,
            `${candidate.name}/`,
          ];
          const matchers = await Promise.all(
            excludePatterns.map((pattern) => createMatcher(pattern))
          );
          const isExcluded = matchers.some((matcher) => {
            return pathsToCheck.some((p) => matcher(p));
          });

          if (isExcluded) {
            continue;
          }

          // Check for package.json in the directory
          const packageJsonPath = path.join(fullPath, 'package.json');
          if (await fileExists(packageJsonPath)) {
            const result = await tryExtractFromPackageJson(
              packageJsonPath,
              options
            );

            if (result) {
              if ('error' in result) {
                errors.push(result.error);
              } else {
                examples.push(result.example);
                for (const file of result.files) {
                  claimedFiles.add(file);
                }
              }
            }
            // If package.json was found, don't also scan for single-file examples
            continue;
          }

          // No package.json - fall back to scanning for single-file examples with frontmatter
          const fileExcludePatterns = [
            ...DEFAULT_EXCLUDE_PATTERNS,
            ...(options.exclude ?? []),
          ];

          const files = await glob(FILE_PATTERNS, {
            cwd: fullPath,
            absolute: true,
            ignore: fileExcludePatterns,
            onlyFiles: true,
          });

          for (const filePath of files) {
            const example = await tryExtractFromFile(
              filePath,
              options.rootPath
            );
            if (example) {
              examples.push(example);
              claimedFiles.add(filePath);
            }
          }
        }
      }

      return { examples, errors, claimedFiles };
    },
  };
}
