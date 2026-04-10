import { SiGithub, SiNpm } from '@icons-pack/react-simple-icons';
import { ChevronDown, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePageContext } from 'vike-react/usePageContext';
import { BlueprintBackground } from '../components/BlueprintBackground';
import { CornerMark } from '../components/BlueprintFrame';
import { Link } from '../components/Link';
import { Logo } from '../components/Logo';
import { PagefindSearch } from '../components/PagefindSearch';
import type { NavigationItem } from '../server/utils/docs';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const navigation = ((pageContext as unknown as Record<string, unknown>)
    .navigation ?? []) as NavigationItem[];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isLandingPage = urlPathname === '/' || urlPathname === '';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [urlPathname, isMobile]);

  const isActive = (href: string): boolean => {
    if (href === '/') return urlPathname === '/';
    return urlPathname === href || urlPathname.startsWith(href + '/');
  };

  const previewPath = import.meta.env.PREVIEW_PATH as string;

  return (
    <div className="min-h-screen flex flex-col text-bp-line bp-grid">
      <BlueprintBackground />

      {previewPath && (
        <div className="bg-amber-900/80 text-amber-200 text-center text-xs py-1.5 px-4 border-b border-amber-700/50">
          Preview deployment for <strong>{previewPath}</strong>{' '}
          &mdash;{' '}
          <a
            href="/functional-examples"
            className="underline hover:text-amber-100"
          >
            Go to production docs
          </a>
        </div>
      )}

      {/* Header — sticky so it participates in flow but stays visible */}
      <header className="sticky top-0 z-50 h-16 shrink-0 bp-glass border-b border-bp-line-dim/20">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="relative flex items-center gap-2.5 px-1 py-0.5 mx-2">
            {!isLandingPage && (
              <>
                <CornerMark position="top-left" size={12} />
                <CornerMark position="top-right" size={12} />
                <CornerMark position="bottom-left" size={12} />
                <CornerMark position="bottom-right" size={12} />
                <Logo size={28} transparent />
              </>
            )}
            <span className="font-heading text-lg tracking-[0.15em] text-bp-line-bright">
              FUNCTIONAL-EXAMPLES
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <HeaderLink href="/docs" active={isActive('/docs')}>
              DOCS
            </HeaderLink>
            <HeaderLink href="/examples" active={isActive('/examples')}>
              EXAMPLES
            </HeaderLink>
            <HeaderLink href="/api" active={isActive('/api')}>
              API
            </HeaderLink>

          </nav>

          {/* Search + external links + mobile menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <PagefindSearch />
            </div>
            <span className="hidden md:block h-4 border-l border-bp-line-dim/30" />
            <a
              href="https://github.com/AgentEnder/functional-examples"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block text-bp-line-dim hover:text-bp-line transition-colors"
              aria-label="GitHub"
            >
              <SiGithub className="w-5 h-5" />
            </a>
            <a
              href="https://www.npmjs.com/package/functional-examples"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block text-bp-line-dim hover:text-bp-line transition-colors"
              aria-label="NPM"
            >
              <SiNpm className="w-5 h-5" />
            </a>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded hover:bg-bp-surface/30 transition-colors"
                aria-label="Toggle menu"
              >
                <Menu className="w-5 h-5 text-bp-line" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile sidebar — rendered on all pages so the hamburger works on the hero too */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
          lg:hidden fixed left-0 top-16 bottom-0 w-72 z-40
          bg-bp-paper border-r border-bp-line-dim/20
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          overflow-y-auto
        `}
      >
        <NavContent
          navigation={navigation}
          activeCheck={isActive}
          onItemClick={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main layout — grows to fill remaining viewport height */}
      {isLandingPage ? (
        <main className="grow">{children}</main>
      ) : (
        <div className="relative flex grow">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block shrink-0 w-64 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto border-r border-bp-line-dim/15 bg-bp-paper/80">
            <NavContent navigation={navigation} activeCheck={isActive} />
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 px-6 lg:px-12 py-8 max-w-6xl">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}

function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      active={active}
      className="text-xs font-heading tracking-widest relative py-1 group"
    >
      {children}
      {/* Active: solid underline. Inactive: draw-in on hover via scale-x */}
      <span
        className={`absolute -bottom-0.5 left-0 right-0 h-0.5 transition-transform duration-300 origin-left ${
          active
            ? 'bg-bp-line scale-x-100'
            : 'bg-bp-line-dim scale-x-0 group-hover:scale-x-100'
        }`}
      />
    </Link>
  );
}

/** Recursively render a list of nav items (leaf links + sub-groups). */
function NavItems({
  items,
  activeCheck,
  onItemClick,
  collapsed,
  toggle,
  depth,
}: {
  items: NavigationItem[];
  activeCheck: (href: string) => boolean;
  onItemClick?: () => void;
  collapsed: Set<string>;
  toggle: (key: string) => void;
  depth: number;
}) {
  return (
    <ul className={`space-y-0.5 ${depth > 0 ? 'ml-1' : ''}`}>
      {items.map((item) => {
        // Sub-group: has children, may or may not have its own path
        if (item.children && item.children.length > 0) {
          const key = `${'  '.repeat(depth)}${item.title}`;
          const isCollapsed = collapsed.has(key);
          return (
            <li key={key} className={depth > 0 ? 'mt-2' : ''}>
              <div className="flex items-center justify-between mb-0.5">
                {item.path ? (
                  <Link
                    href={item.path}
                    onClick={onItemClick}
                    className="bp-annotation text-[10px] text-bp-accent hover:text-bp-line transition-colors"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <span className="bp-annotation text-[10px] text-bp-line-dim">
                    {item.title}
                  </span>
                )}
                <button
                  onClick={() => toggle(key)}
                  className="text-bp-line-dim hover:text-bp-line transition-colors p-0.5"
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                    strokeWidth={2}
                  />
                </button>
              </div>
              {!isCollapsed && (
                <NavItems
                  items={item.children}
                  activeCheck={activeCheck}
                  onItemClick={onItemClick}
                  collapsed={collapsed}
                  toggle={toggle}
                  depth={depth + 1}
                />
              )}
            </li>
          );
        }

        // Leaf item: link
        if (!item.path) return null;
        return (
          <li key={item.path}>
            <Link
              href={item.path}
              onClick={onItemClick}
              className={`
                block px-3 py-1.5 rounded text-sm transition-all duration-200 border-l-2
                ${
                  activeCheck(item.path)
                    ? 'border-bp-accent text-bp-line bg-bp-accent/5'
                    : 'border-transparent text-bp-line-dim hover:text-bp-line hover:border-bp-line-dim/40 hover:bg-bp-surface/20'
                }
              `}
            >
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavContent({
  navigation,
  activeCheck,
  onItemClick,
}: {
  navigation: NavigationItem[];
  activeCheck: (href: string) => boolean;
  onItemClick?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <nav className="p-4 space-y-4">
      {navigation.map((section) => {
        const isCollapsed = collapsed.has(section.title);
        return (
          <div key={section.title}>
            <div className="flex items-center justify-between mb-1.5">
              {section.path ? (
                <Link
                  href={section.path}
                  onClick={onItemClick}
                  className="bp-annotation text-bp-accent hover:text-bp-line transition-colors"
                >
                  {section.title}
                </Link>
              ) : (
                <span className="bp-annotation text-bp-line-dim">
                  {section.title}
                </span>
              )}
              {section.children && section.children.length > 0 && (
                <button
                  onClick={() => toggle(section.title)}
                  className="text-bp-line-dim hover:text-bp-line transition-colors p-0.5"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                    strokeWidth={2}
                  />
                </button>
              )}
            </div>

            {!isCollapsed && section.children && (
              <NavItems
                items={section.children}
                activeCheck={activeCheck}
                onItemClick={onItemClick}
                collapsed={collapsed}
                toggle={toggle}
                depth={0}
              />
            )}
          </div>
        );
      })}

      {/* External links */}
      <div className="border-t border-bp-line-dim/20 pt-4 mt-4 flex items-center gap-4">
        <a
          href="https://github.com/AgentEnder/functional-examples"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-bp-line-dim hover:text-bp-line transition-colors text-xs"
        >
          <SiGithub className="w-4 h-4" />
          GitHub
        </a>
        <a
          href="https://www.npmjs.com/package/functional-examples"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-bp-line-dim hover:text-bp-line transition-colors text-xs"
        >
          <SiNpm className="w-4 h-4" />
          NPM
        </a>
      </div>
    </nav>
  );
}
