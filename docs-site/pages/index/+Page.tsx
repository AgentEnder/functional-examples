import { useEffect, useRef, useState } from 'react';
import { BlueprintFrame, CornerMark } from '../../components/BlueprintFrame';
import { CodeBlock } from '../../components/CodeBlock';
import { DimensionLine } from '../../components/DimensionLine';
import { Link } from '../../components/Link';
import { Logo } from '../../components/Logo';
import { SpecPanel } from '../../components/SpecPanel';
import { TitleBlock } from '../../components/TitleBlock';
import { useDrawAnimation } from '../../hooks/useDrawAnimation';

export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <ArchitectureDiagram />
      <FeatureGrid />
      <CodePreviewSection />
      <StatsBar />
    </div>
  );
}

/* ─── Hero Section ─── */
function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-4xl mx-auto">
        <div
          className="mb-8 opacity-0 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          <Logo size={80} className="mx-auto" />
        </div>
        <div
          className="flex items-center justify-center gap-4 mb-6 opacity-0 animate-fade-in"
          style={{ animationDelay: '300ms' }}
        >
          <DimensionLine length={120} delay={500} />
          <h1 className="text-4xl md:text-6xl font-heading tracking-[0.15em] text-bp-line-bright">
            FUNCTIONAL EXAMPLES
          </h1>
          <DimensionLine length={120} delay={700} />
        </div>

        <p
          className="text-lg md:text-xl text-bp-line-dim mb-10 max-w-2xl mx-auto opacity-0 animate-fade-in"
          style={{ animationDelay: '500ms' }}
        >
          A toolkit for managing, scanning, and validating code examples in
          documentation projects
        </p>

        <div
          className="flex items-center justify-center gap-6 mb-16 opacity-0 animate-fade-in"
          style={{ animationDelay: '700ms' }}
        >
          <Link
            href="/docs"
            className="relative px-6 py-2.5 border border-bp-line text-bp-line font-heading text-sm tracking-wider
                       hover:bg-bp-line/10 hover:text-bp-line-bright transition-all"
          >
            <CornerMark
              position="top-left"
              size={10}
              className="text-bp-line-bright"
            />
            <CornerMark
              position="top-right"
              size={10}
              className="text-bp-line-bright"
            />
            <CornerMark
              position="bottom-left"
              size={10}
              className="text-bp-line-bright"
            />
            <CornerMark
              position="bottom-right"
              size={10}
              className="text-bp-line-bright"
            />
            GET STARTED
          </Link>
          <Link
            href="/examples"
            className="relative px-6 py-2.5 border border-bp-line-dim text-bp-line-dim font-heading text-sm tracking-wider
                       hover:border-bp-line hover:text-bp-line transition-all"
          >
            <CornerMark
              position="top-left"
              size={10}
              className="text-bp-line"
            />
            <CornerMark
              position="top-right"
              size={10}
              className="text-bp-line"
            />
            <CornerMark
              position="bottom-left"
              size={10}
              className="text-bp-line"
            />
            <CornerMark
              position="bottom-right"
              size={10}
              className="text-bp-line"
            />
            VIEW EXAMPLES
          </Link>
        </div>
      </div>

      {/* Title Block in bottom-right — account for fixed header (h-16 = 4rem) */}
      <div className="absolute bottom-4 right-8 hidden lg:block">
        <TitleBlock sheet="LANDING" />
      </div>
    </section>
  );
}

/* ─── Architecture Diagram ─── */
function ArchitectureDiagram() {
  const pathRef = useRef<SVGPathElement>(null);
  useDrawAnimation(pathRef, { delay: 600, duration: 2000 });

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <DimensionLine
            label="ARCHITECTURE"
            length={300}
            delay={100}
            className="mb-4"
          />
          <h2 className="text-2xl font-heading text-bp-line-bright mb-3">
            PLUGIN ARCHITECTURE
          </h2>
          <p className="text-bp-line-dim max-w-xl mx-auto">
            Composable plugins provide extractors, parsers, validators, and
            schemas
          </p>
        </div>

        <BlueprintFrame>
          <svg
            viewBox="0 0 800 300"
            className="w-full h-auto"
            aria-label="Architecture diagram showing dependency flow"
          >
            <defs>
              <marker
                id="arrow-up"
                markerWidth="6"
                markerHeight="6"
                refX="3"
                refY="6"
                orient="auto"
              >
                <path
                  d="M0,6 L3,0 L6,6"
                  fill="none"
                  stroke="var(--color-bp-line-dim)"
                  strokeWidth="1"
                />
              </marker>
              <marker
                id="arrow-up-accent"
                markerWidth="6"
                markerHeight="6"
                refX="3"
                refY="6"
                orient="auto"
              >
                <path
                  d="M0,6 L3,0 L6,6"
                  fill="none"
                  stroke="var(--color-bp-accent-dim)"
                  strokeWidth="1"
                />
              </marker>
            </defs>

            {/* ── Tier 1: Devkit ── */}
            <rect
              x="300"
              y="24"
              width="200"
              height="52"
              rx="2"
              fill="rgba(108,180,224,0.06)"
              stroke="var(--color-bp-line-bright)"
              strokeWidth="1.5"
            />
            <text
              x="400"
              y="55"
              textAnchor="middle"
              fill="var(--color-bp-line-bright)"
              fontSize="13"
              fontFamily="var(--font-heading)"
              letterSpacing="0.08em"
            >
              DEVKIT
            </text>
            <text
              x="400"
              y="18"
              textAnchor="middle"
              fill="var(--color-bp-line-dim)"
              fontSize="7"
              fontFamily="var(--font-heading)"
              letterSpacing="0.12em"
            >
              PUBLIC API · TYPES · UTILITIES
            </text>

            {/* ── Tier 2: Core ── */}
            <rect
              x="310"
              y="132"
              width="180"
              height="46"
              rx="2"
              fill="none"
              stroke="var(--color-bp-line)"
              strokeWidth="1"
            />
            <text
              x="400"
              y="160"
              textAnchor="middle"
              fill="var(--color-bp-line)"
              fontSize="12"
              fontFamily="var(--font-heading)"
              letterSpacing="0.06em"
            >
              CORE
            </text>

            {/* Core → Devkit connector */}
            <line
              x1="400"
              y1="132"
              x2="400"
              y2="76"
              stroke="var(--color-bp-line-dim)"
              strokeWidth="1"
              markerEnd="url(#arrow-up)"
            />
            <text
              x="414"
              y="108"
              fill="var(--color-bp-line-dim)"
              fontSize="7"
              fontFamily="var(--font-heading)"
              letterSpacing="0.1em"
            >
              IMPORTS
            </text>

            {/* ── Shared dependency bus ── */}
            {/* Horizontal line all plugins connect to, then one trunk up to devkit */}
            <line
              x1="110"
              y1="214"
              x2="690"
              y2="214"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
              strokeDasharray="4 3"
            />
            <line
              x1="400"
              y1="214"
              x2="400"
              y2="76"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-up-accent)"
            />

            {/* Bus label */}
            <text
              x="400"
              y="208"
              textAnchor="middle"
              fill="var(--color-bp-accent-dim)"
              fontSize="7"
              fontFamily="var(--font-heading)"
              letterSpacing="0.1em"
            >
              ALL PLUGINS DEPEND ON DEVKIT
            </text>

            {/* Vertical taps from bus down to each plugin */}
            <line
              x1="110"
              y1="214"
              x2="110"
              y2="236"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
            />
            <line
              x1="330"
              y1="214"
              x2="330"
              y2="236"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
            />
            <line
              x1="510"
              y1="214"
              x2="510"
              y2="236"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
            />
            <line
              x1="690"
              y1="214"
              x2="690"
              y2="236"
              stroke="var(--color-bp-accent-dim)"
              strokeWidth="0.5"
            />

            {/* ── Tier 3: Plugins ── */}
            <rect
              x="40"
              y="236"
              width="140"
              height="42"
              rx="2"
              fill="none"
              stroke="var(--color-bp-accent)"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <text
              x="110"
              y="262"
              textAnchor="middle"
              fill="var(--color-bp-accent)"
              fontSize="10"
              fontFamily="var(--font-heading)"
            >
              JAVASCRIPT
            </text>

            <rect
              x="260"
              y="236"
              width="140"
              height="42"
              rx="2"
              fill="none"
              stroke="var(--color-bp-accent)"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <text
              x="330"
              y="262"
              textAnchor="middle"
              fill="var(--color-bp-accent)"
              fontSize="10"
              fontFamily="var(--font-heading)"
            >
              YAML-MANIFEST
            </text>

            <rect
              x="440"
              y="236"
              width="140"
              height="42"
              rx="2"
              fill="none"
              stroke="var(--color-bp-accent)"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <text
              x="510"
              y="262"
              textAnchor="middle"
              fill="var(--color-bp-accent)"
              fontSize="10"
              fontFamily="var(--font-heading)"
            >
              TEST
            </text>

            <rect
              x="620"
              y="236"
              width="140"
              height="42"
              rx="2"
              fill="none"
              stroke="var(--color-bp-accent)"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <text
              x="690"
              y="262"
              textAnchor="middle"
              fill="var(--color-bp-accent)"
              fontSize="10"
              fontFamily="var(--font-heading)"
            >
              DOCUMENTATION
            </text>
          </svg>
        </BlueprintFrame>
      </div>
    </section>
  );
}

/* ─── Feature Grid ─── */
const features = [
  {
    title: 'Plugin Architecture',
    description:
      'Define extractors, parsers, and validators as composable plugins.',
    type: 'core',
    status: 'stable',
  },
  {
    title: 'Multi-Format Support',
    description:
      'JavaScript frontmatter, YAML manifests, JSON configs, and custom extractors.',
    type: 'extractor',
    status: 'stable',
  },
  {
    title: 'Type Generation',
    description:
      'Generate TypeScript types from JSON Schema metadata definitions.',
    type: 'schema',
    status: 'stable',
  },
  {
    title: 'Test Runner',
    description:
      'Run test commands defined in example metadata with TAP/pretty reporters.',
    type: 'plugin',
    status: 'stable',
  },
  {
    title: 'Custom Extractors',
    description:
      'Build extractors for any metadata format — TOML, frontmatter, or your own.',
    type: 'api',
    status: 'stable',
  },
  {
    title: 'Documentation Generation',
    description:
      'Generate documentation pages from scanned examples automatically.',
    type: 'plugin',
    status: 'beta',
  },
];

function FeatureGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <DimensionLine
            label="FEATURES"
            length={250}
            delay={100}
            className="mb-4"
          />
          <h2 className="text-2xl font-heading text-bp-line-bright">
            CAPABILITIES
          </h2>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((feature, i) => (
            <SpecPanel
              key={feature.title}
              label="SPEC"
              revision="1.0"
              footer={[
                { key: 'TYPE', value: feature.type },
                { key: 'STATUS', value: feature.status },
              ]}
              className={visible ? 'opacity-0 animate-fade-in' : 'opacity-0'}
              style={visible ? { animationDelay: `${i * 100}ms` } : undefined}
            >
              <h3 className="text-sm font-heading text-bp-line mb-2 normal-case">
                {feature.title}
              </h3>
              <p className="text-xs text-bp-line-dim leading-relaxed">
                {feature.description}
              </p>
            </SpecPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Code Preview ─── */
const sampleCode = `import { scanExamples, loadConfig, resolveConfig } from 'functional-examples';
import { createJavaScriptPlugin } from '@functional-examples/javascript';

const config = await loadConfig('./functional-examples.config.ts');
const resolved = await resolveConfig(config);
const result = await scanExamples(resolved);

console.log(\`Found \${result.stats.examplesFound} examples\`);

for (const example of result.examples) {
  console.log(\`  \${example.title} (\${example.files.length} files)\`);
}`;

function CodePreviewSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <BlueprintFrame title="QUICK START" showTitleBlock>
          <CodeBlock
            code={sampleCode}
            language="typescript"
            filename="scan.ts"
          />
        </BlueprintFrame>

        <div className="text-center mt-6">
          <Link
            href="/examples"
            className="group text-bp-accent hover:text-bp-line transition-colors font-heading text-sm tracking-wider"
          >
            SEE ALL EXAMPLES{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Bar ─── */
function CountUp({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * to));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{value}</span>;
}

function StatsBar() {
  const stats: Array<{ label: string; value: number | null; text?: string }> = [
    { label: 'Examples', value: 8 },
    { label: 'Plugins', value: 4 },
    { label: 'Extractors', value: 3 },
    { label: 'Language', value: null, text: 'TypeScript' },
  ];

  return (
    <section className="py-12 px-4 border-t border-bp-line-dim/15">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-8 flex-wrap">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-3">
            {i > 0 && (
              <DimensionLine
                direction="vertical"
                length={24}
                className="hidden md:block"
              />
            )}
            <div className="text-center">
              <div className="text-lg font-heading text-bp-line">
                {stat.value != null ? <CountUp to={stat.value} /> : stat.text}
              </div>
              <div className="bp-annotation">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
