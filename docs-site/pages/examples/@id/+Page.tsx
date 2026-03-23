import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from 'vike-react/useData';
import {
  parseLineHash,
  slugifyFilename,
  type HighlightLines,
} from '../../../components/CodeBlock';
import { FileExplorer } from '../../../components/FileExplorer';
import { Link } from '../../../components/Link';
import { ProseRenderer } from '../../../components/ProseRenderer';
import type { ExampleDetailData } from './+data.js';

const EXPLORER_PREFIX = 'explorer-';

/**
 * Resolve a hash like `#explorer-scan-ts-L10` to { file, highlight }.
 * Matches the slug portion against the example's files.
 */
function resolveExplorerHash(
  hash: string,
  files: { relativePath: string }[]
): { file: string; highlight: HighlightLines | null } | null {
  const parsed = parseLineHash(hash);
  if (!parsed || !parsed.prefix.startsWith(EXPLORER_PREFIX)) return null;

  const slug = parsed.prefix.slice(EXPLORER_PREFIX.length);
  const file = files.find((f) => slugifyFilename(f.relativePath) === slug);
  if (!file) return null;

  return {
    file: file.relativePath,
    highlight: { start: parsed.start, end: parsed.end },
  };
}

export default function ExampleDetail() {
  const { example } = useData<ExampleDetailData>();

  const files = useMemo(() => example?.files ?? [], [example?.files]);

  // Default to first non-package.json file (matches FileExplorer's uncontrolled default)
  const fallbackFile =
    files.find((f) => f.relativePath !== 'package.json')?.relativePath ??
    files[0]?.relativePath ??
    null;

  const [activeFile, setActiveFile] = useState<string | null>(fallbackFile);
  const [highlightLines, setHighlightLines] = useState<HighlightLines | null>(
    null
  );
  const fileExplorerRef = useRef<HTMLDivElement>(null);

  // On mount, check if URL hash targets the explorer and select that file
  useEffect(() => {
    const resolved = resolveExplorerHash(window.location.hash, files);
    if (resolved) {
      setActiveFile(resolved.file);
      // highlight is handled by CodeBlock's own hash listener
    }
  }, [files]);

  // Listen for hash changes targeting the explorer (e.g. from prose anchor clicks)
  useEffect(() => {
    const handleHashChange = () => {
      const resolved = resolveExplorerHash(window.location.hash, files);
      if (resolved) {
        setActiveFile(resolved.file);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [files]);

  const handleNavigateToFile = useCallback(
    (file: string, regionId?: string) => {
      setActiveFile(file);

      // Look up line range from the file's hunks
      if (regionId && example) {
        const siteFile = example.files.find((f) => f.relativePath === file);
        const hunk = siteFile?.hunks?.find((h) => h.id === regionId);
        if (hunk) {
          setHighlightLines({ start: hunk.startLine, end: hunk.endLine });
        } else {
          setHighlightLines(null);
        }
      } else {
        setHighlightLines(null);
      }

      // Scroll to file explorer
      requestAnimationFrame(() => {
        fileExplorerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [example]
  );

  const handleActiveFileChange = useCallback((file: string) => {
    setActiveFile(file);
    setHighlightLines(null);
  }, []);

  if (!example) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-heading text-bp-line-bright mb-4">
          EXAMPLE NOT FOUND
        </h1>
        <p className="text-bp-line-dim">No example was found.</p>
        <Link
          href="/examples"
          className="inline-block mt-6 text-bp-accent hover:text-bp-line transition-colors font-heading text-sm tracking-wider"
        >
          ← BACK TO EXAMPLES
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Prose content — capped at readable width */}
      <div className="max-w-4xl">
        {/* Breadcrumb */}
        <div className="bp-annotation mb-4 flex items-center gap-2">
          <Link
            href="/examples"
            className="text-bp-line-dim hover:text-bp-line transition-colors"
          >
            EXAMPLES
          </Link>
          <span className="text-bp-line-dim/50">/</span>
          <span className="text-bp-line">{example.id}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-heading text-bp-line-bright mb-2">
            {example.title}
          </h1>
          {example.description && (
            <p className="text-bp-line-dim max-w-2xl">{example.description}</p>
          )}
        </div>

        {/* Metadata stamps */}
        <div className="flex gap-3 flex-wrap mb-6">
          <span className="bp-stamp text-bp-accent">
            {example.extractorName}
          </span>
          <span className="bp-stamp text-bp-line-dim">
            {example.files.length} FILES
          </span>
          {example.tags.map((tag) => (
            <span key={tag} className="bp-stamp text-bp-green">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Rendered prose — structured blocks break out of max-w for code */}
      {example.proseBlocks ? (
        <div className="mb-10">
          <ProseRenderer
            blocks={example.proseBlocks}
            onNavigateToFile={handleNavigateToFile}
          />
          <hr className="bp-dashed-sep mt-8 max-w-4xl" />
        </div>
      ) : example.renderedProseHtml ? (
        <div className="mb-10 max-w-4xl">
          <div
            className="prose-blueprint"
            dangerouslySetInnerHTML={{ __html: example.renderedProseHtml }}
          />
          <hr className="bp-dashed-sep mt-8" />
        </div>
      ) : null}

      <div className="max-w-4xl">
        <div className="prose-blueprint">
          <h2>All Example Files</h2>
        </div>
      </div>

      {/* File Explorer — full width, not capped */}
      <FileExplorer
        ref={fileExplorerRef}
        files={example.files}
        activeFile={activeFile}
        onActiveFileChange={handleActiveFileChange}
        highlightLines={highlightLines}
        className="mb-8"
      />
    </div>
  );
}
