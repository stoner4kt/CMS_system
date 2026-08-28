import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp, Clock3, Code2, Copy,
  FileText, FolderOpen, Globe2, ImagePlus, LayoutTemplate, LifeBuoy, LogOut,
  Menu, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Settings, Sparkles,
  Trash2, Upload, Users, X, Zap,
} from 'lucide-react';
import {
  useCreateMedia, useCreatePage, useCreateSubmission, useDeleteMedia, useDeletePage,
  useGetDashboard, useGetPage, useGetSite, useHealthCheck, useListMedia,
  useListPages, useListSubmissions, usePublishPage, useUpdatePage, useUpdateSite,
  getGetDashboardQueryKey, getGetPageQueryKey, getGetSiteQueryKey, getListMediaQueryKey,
  getListPagesQueryKey, getListSubmissionsQueryKey,
  type Block, type ContactSubmission, type Media, type Page, type Site, type SiteSettings,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { supabase } from '@/lib/supabase';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const SITE_ID = 'current';

const fallbackSite: Site = {
  id: SITE_ID, name: 'Northstar Ceramics', slug: 'northstar-ceramics', template: 'modern',
  settings: {
    primaryColor: '#D9644A', accentColor: '#2F6B68', fontFamily: 'Bricolage Grotesque',
    contactEmail: 'hello@northstarceramics.co', phone: '(415) 555-0148',
    address: '189 Valencia Street, San Francisco', socialLinks: { instagram: 'northstarceramics' },
  },
};
const starterBlocks: Block[] = [
  { id: 'hero-1', type: 'hero', data: { eyebrow: 'Handmade in San Francisco', title: 'Objects with a little weather in them.', body: 'Northstar makes useful ceramic pieces for slow mornings, shared tables, and the spaces between.', buttonText: 'Visit the studio' } },
  { id: 'text-1', type: 'text-image', data: { heading: 'Made for daily rituals', body: 'Every piece is wheel-thrown, trimmed, and glazed by hand in our Valencia Street studio.', imageUrl: '' } },
  { id: 'features-1', type: 'features', data: { heading: 'Small batch, long life', items: ['Thrown by hand', 'Food-safe glazes', 'Packed with care'] } },
  { id: 'cta-1', type: 'cta', data: { heading: 'Come see what is on the shelf', body: 'Open Wednesday through Sunday, 11–6.', buttonText: 'Get directions' } },
];
const fallbackPage: Page = {
  id: 'home', title: 'Home', slug: 'home', status: 'published', sortOrder: 0,
  blocks: starterBlocks, seo: { title: 'Northstar Ceramics — Handmade in San Francisco', description: 'Handmade ceramic objects for daily rituals.' },
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function getData(data: Block['data'], key: string, fallback = '') {
  const value = data[key];
  return typeof value === 'string' ? value : fallback;
}

function StatusPill({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.12em]', status === 'published' || status === 'read' ? 'bg-[#dcebe2] text-[#2f6b57]' : status === 'new' ? 'bg-[#f8dfc9] text-[#a64f34]' : 'bg-muted text-muted-foreground')}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {status}
  </span>;
}

function LoadingPanel({ label = 'Gathering your studio' }: { label?: string }) {
  return <div data-testid="state-loading" className="rounded-2xl border border-card-border bg-card p-6">
    <div className="mb-5 flex items-center gap-3"><div className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span className="font-mono-ui text-[11px] uppercase tracking-[.16em] text-muted-foreground">{label}</span></div>
    <div className="space-y-3"><div className="skeleton h-4 w-2/3 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
  </div>;
}

function ErrorPanel({ onRetry, message = 'The studio could not load this view.' }: { onRetry?: () => void; message?: string }) {
  return <div data-testid="state-error" className="rounded-2xl border border-[#e5b6a8] bg-[#fff3ed] p-8 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f8dfc9] text-primary"><Zap size={18} /></div>
    <h3 className="font-display text-xl">A loose thread</h3><p className="mt-1 text-sm text-muted-foreground">{message}</p>
    {onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-5 rounded-full border border-primary px-4 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground">Try again</button>}
  </div>;
}

function EmptyPanel({ icon: Icon, title, body, action }: { icon: typeof FileText; title: string; body: string; action?: ReactNode }) {
  return <div data-testid="state-empty" className="rounded-2xl border border-dashed border-card-border bg-card/60 px-7 py-14 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-accent"><Icon size={21} /></div>
    <h3 className="font-display text-2xl">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-6">{action}</div>}
  </div>;
}

function Button({ children, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'quiet' }) {
  return <button {...props} className={cx('inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold', variant === 'primary' ? 'bg-primary text-primary-foreground hover:brightness-95' : variant === 'outline' ? 'border border-border bg-card text-foreground hover:border-primary hover:text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground', className)}>{children}</button>;
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; multiline?: boolean }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span>
    {multiline ? <textarea data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /> :
      <input data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />}
  </label>;
}

function PublicPreview() {
  const siteQuery = useGetSite(SITE_ID, { query: { queryKey: getGetSiteQueryKey(SITE_ID) } });
  const pagesQuery = useListPages({ query: { queryKey: getListPagesQueryKey() } });
  const submit = useCreateSubmission();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const site = siteQuery.data ?? fallbackSite;
  const page = pagesQuery.data?.find((item) => item.status === 'published') ?? pagesQuery.data?.[0] ?? fallbackPage;
  const blocks = page.blocks?.length ? page.blocks : starterBlocks;

  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate({ data: form }, { onSuccess: () => { setSent(true); setForm({ name: '', email: '', message: '' }); } });
  };

  return <div data-testid="public-preview" className="min-h-[100dvh] bg-[#f6f0e6] text-[#2b2630]">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-10">
      <Link href="/admin" data-testid="link-admin-from-preview" className="flex items-center gap-3">
        <span className="flex h-9 w-9 rotate-3 items-center justify-center rounded-xl bg-[#2b2630] text-[#f7dbaf]"><Sparkles size={17} /></span>
        <span className="font-display text-xl font-bold tracking-tight">{site.name}</span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
        <a data-testid="link-preview-work" href="#work" className="hover:text-primary">The work</a><a data-testid="link-preview-contact" href="#contact" className="hover:text-primary">Contact</a>
        <Link data-testid="link-preview-admin" href="/admin" className="rounded-full border border-[#2b2630]/20 px-4 py-2 hover:border-primary hover:text-primary">Open studio <ArrowUpRight size={14} /></Link>
      </nav>
    </header>
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-12 md:grid-cols-[1.12fr_.88fr] md:items-center md:px-10 md:pb-32 md:pt-20">
        <div className="reveal">
          <p className="mb-5 font-mono-ui text-[11px] uppercase tracking-[.18em] text-[#a64f34]">{getData(blocks[0]?.data ?? {}, 'eyebrow', 'A small studio with a point of view')}</p>
          <h1 data-testid="text-preview-title" className="max-w-3xl font-display text-[clamp(3.6rem,9vw,7.7rem)] font-semibold leading-[.86] tracking-[-.07em]">{getData(blocks[0]?.data ?? {}, 'title', page.title)}</h1>
          <p className="mt-8 max-w-md text-base leading-7 text-[#716976]">{getData(blocks[0]?.data ?? {}, 'body', page.seo.description)}</p>
          <a data-testid="link-preview-hero-cta" href="#work" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#2b2630] px-5 py-3 text-sm font-semibold text-[#f7dbaf] hover:-translate-y-0.5"><span>{getData(blocks[0]?.data ?? {}, 'buttonText', 'Explore the work')}</span><ArrowUpRight size={16} /></a>
        </div>
        <div className="reveal reveal-delay-2 relative min-h-[360px] overflow-hidden rounded-[2.2rem] bg-[#d9644a] p-7 md:min-h-[510px]">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[38px] border-[#f7dbaf]/60" /><div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#2f6b68]/80" />
          <div className="absolute left-8 top-8 font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#2b2630]/60">Field note / 001</div>
          <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between"><div><div className="mb-2 h-20 w-20 rounded-[2rem] rounded-br-[.4rem] bg-[#f7dbaf] shadow-[18px_18px_0_#2b2630]/15" /><p className="font-display text-2xl text-[#f7dbaf]">Made slowly.</p></div><span className="rounded-full border border-[#f7dbaf]/50 px-3 py-1 font-mono-ui text-[10px] text-[#f7dbaf]">SF / CA</span></div>
        </div>
      </section>
      <section id="work" className="bg-[#2b2630] px-5 py-20 text-[#f6f0e6] md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl"><div className="mb-14 flex items-end justify-between gap-5"><div><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#e7a05c]">The practice</p><h2 className="font-display text-4xl leading-none tracking-tight md:text-6xl">Useful things,<br /><span className="text-[#e7a05c]">beautifully considered.</span></h2></div><span className="hidden font-mono-ui text-[11px] text-[#aaa1a8] md:block">Scroll / keep looking</span></div>
          <div className="grid gap-4 md:grid-cols-12">
            <div className="rounded-[1.6rem] bg-[#f7dbaf] p-7 text-[#2b2630] md:col-span-7 md:min-h-[360px]"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#a64f34]">01 / Daily rituals</span><h3 className="mt-24 max-w-sm font-display text-4xl leading-[.95]">The things you reach for without thinking.</h3><p className="mt-5 max-w-sm text-sm leading-6 text-[#716976]">{getData(blocks[1]?.data ?? {}, 'body', 'Objects that earn their place on the table.')}</p></div>
            <div className="relative overflow-hidden rounded-[1.6rem] bg-[#2f6b68] p-7 md:col-span-5 md:min-h-[360px]"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#b9d9c7]">02 / Small batches</span><div className="absolute bottom-7 left-7 right-7"><div className="mb-5 flex gap-2"><div className="h-20 w-16 rounded-t-full rounded-b-lg bg-[#e7a05c]" /><div className="mt-7 h-16 w-14 rounded-t-full rounded-b-lg bg-[#f7dbaf]" /><div className="h-24 w-16 rounded-t-full rounded-b-lg bg-[#d9644a]" /></div><h3 className="font-display text-3xl leading-none text-[#f7dbaf]">No two alike.<br />That is the point.</h3></div></div>
            <div className="rounded-[1.6rem] border border-[#aaa1a8]/25 p-7 md:col-span-5"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#e7a05c]">03 / In person</span><h3 className="mt-24 font-display text-3xl leading-none">Come by the studio.</h3><p className="mt-4 text-sm leading-6 text-[#aaa1a8]">{site.settings.address ?? 'Valencia Street, San Francisco'}</p></div>
            <div className="rounded-[1.6rem] bg-[#d9644a] p-7 text-[#2b2630] md:col-span-7"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#2b2630]/60">04 / Keep in touch</span><h3 className="mt-24 font-display text-3xl leading-none">A note is always welcome.</h3><a data-testid="link-preview-contact-cta" href="#contact" className="mt-5 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Write to us <ArrowUpRight size={14} /></a></div>
          </div>
        </div>
      </section>
      <section id="contact" className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[.8fr_1.2fr] md:px-10 md:py-28">
        <div><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Contact</p><h2 className="font-display text-5xl leading-[.9] tracking-tight">Let’s make<br />a good thing.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">For stockists, workshops, or just a question about a piece, send a note.</p></div>
        {sent ? <div data-testid="status-contact-sent" className="rounded-2xl border border-[#b9d9c7] bg-[#e8f2e9] p-8"><Check className="mb-6 text-[#2f6b57]" /><h3 className="font-display text-3xl">Note received.</h3><p className="mt-2 text-sm text-muted-foreground">We’ll be in touch soon.</p><Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another</Button></div> :
          <form data-testid="form-public-contact" onSubmit={submitContact} className="grid gap-5 rounded-2xl border border-card-border bg-card p-6 md:grid-cols-2 md:p-8"><Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="Your name" /><Field label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} placeholder="you@example.com" type="email" /><div className="md:col-span-2"><Field label="Message" value={form.message} onChange={(message) => setForm({ ...form, message })} placeholder="What’s on your mind?" multiline /></div><div className="md:col-span-2"><Button data-testid="button-send-contact" type="submit" disabled={submit.isPending}>{submit.isPending ? 'Sending…' : 'Send note'} <ArrowUpRight size={15} /></Button></div></form>}
      </section>
    </main>
    <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[#2b2630]/10 px-5 py-7 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10"><span>© {new Date().getFullYear()} {site.name}</span><span>{site.settings.contactEmail}</span></footer>
  </div>;
}

const navItems = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/pages', label: 'Pages', icon: FileText },
  { href: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/admin/media', label: 'Media', icon: ImagePlus },
  { href: '/admin/submissions', label: 'Submissions', icon: MessageSquare },
];

function AdminShell() {
  const [location, setLocation] = useLocation();
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [isAuthed, setIsAuthed] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(Boolean(data.session));
      setSessionReady(true);
      if (!data.session) setLocation('/login');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
      if (!session) setLocation('/login');
      queryClient.invalidateQueries();
    });
    return () => listener.subscription.unsubscribe();
  }, [setLocation]);
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!sessionReady) return <LoadingPanel label="Checking your session" />;
  if (!isAuthed) return null;
  const health = useHealthCheck();
  const siteQuery = useGetSite(SITE_ID, { query: { queryKey: getGetSiteQueryKey(SITE_ID) } });
  const site = siteQuery.data ?? fallbackSite;
  const active = (href: string) => href === '/admin' ? location === href : location.startsWith(href);
  const content = <Switch>
    <Route path="/admin" component={Dashboard} />
    <Route path="/admin/pages" component={PagesManager} />
    <Route path="/admin/pages/new" component={PageEditor} />
    <Route path="/admin/pages/:id" component={PageEditor} />
    <Route path="/admin/templates" component={Templates} />
    <Route path="/admin/media" component={MediaLibrary} />
    <Route path="/admin/submissions" component={Submissions} />
    <Route path="/admin/settings" component={SettingsPage} />
    <Route component={NotFoundView} />
  </Switch>;
  return <div className="min-h-[100dvh] bg-background">
    <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center justify-between px-3"><Link href="/admin" data-testid="link-admin-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 rotate-3 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles size={17} /></span><span className="font-display text-xl font-bold">Site Studio</span></Link><button data-testid="button-close-menu" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/60 md:hidden"><X size={18} /></button></div>
      <div className="mt-10 px-2"><p className="mb-3 px-3 font-mono-ui text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</p>{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`} className={cx('group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground', active(href) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground')}><Icon size={17} strokeWidth={active(href) ? 2.4 : 1.8} /><span>{label}</span>{label === 'Submissions' && <span className="ml-auto rounded-full bg-sidebar-primary/20 px-2 py-0.5 font-mono-ui text-[10px] text-sidebar-primary">4</span>}</Link>)}</div>
      <div className="mt-auto space-y-1"><Link href="/admin/settings" data-testid="link-nav-settings" className={cx('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground', active('/admin/settings') && 'bg-sidebar-accent text-sidebar-foreground')}><Settings size={17} /> Settings</Link><button data-testid="button-sidebar-support" onClick={() => window.alert('Support is on the way. Email support@sitestudio.local.')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LifeBuoy size={17} /> Support <span className="ml-auto font-mono-ui text-[10px] text-sidebar-foreground/40">?</span></button><div className="mt-3 flex items-center gap-3 border-t border-sidebar-border px-3 pt-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7a05c] text-xs font-bold text-[#2b2630]">MC</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">Maya Chen</p><p className="truncate text-[11px] text-sidebar-foreground/45">Owner</p></div><button data-testid="button-logout" onClick={() => supabase ? supabase.auth.signOut() : setLocation('/login')} className="text-sidebar-foreground/45 hover:text-sidebar-foreground"><LogOut size={15} /></button></div></div>
    </aside>
    {mobileOpen && <button data-testid="button-menu-overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#2b2630]/35 md:hidden" aria-label="Close navigation" />}
    <div className="md:pl-[252px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur md:px-9"><div className="flex items-center gap-3"><button data-testid="button-open-menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted md:hidden"><Menu size={20} /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className="font-mono-ui uppercase tracking-[.12em]">Sites</span><ChevronRight size={13} /><span className="font-semibold text-foreground">{site.name}</span></div><div className="md:hidden font-display text-lg font-bold">Site Studio</div></div><div className="flex items-center gap-3"><span data-testid="status-api" className="hidden items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:flex"><span className={cx('h-1.5 w-1.5 rounded-full', health.isError ? 'bg-destructive' : 'bg-[#4e9b73]')} /> {health.isError ? 'Offline' : 'All systems ready'}</span><Link href="/" data-testid="link-view-live-site" className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary"><Globe2 size={14} /> <span className="hidden sm:inline">View live site</span><ArrowUpRight size={13} /></Link></div></header><main className="mx-auto max-w-[1440px] px-5 py-7 md:px-9 md:py-10">{content}</main></div>
  </div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 data-testid={`text-heading-${title.toLowerCase().replaceAll(' ', '-')}`} className="font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Dashboard() {
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const pages = useListPages({ query: { queryKey: getListPagesQueryKey() } });
  const stats = dashboard.data ?? { pages: pages.data?.length ?? 0, publishedPages: pages.data?.filter((page) => page.status === 'published').length ?? 0, media: 0, submissions: 0, recentActivity: [] };
  return <div className="reveal"><PageHeader eyebrow="Monday, 14 October" title="Good morning, Maya." description="A quick read on what is happening across Northstar Ceramics." action={<Link href="/admin/pages/new" data-testid="link-new-page-dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:-translate-y-0.5"><Plus size={16} /> New page</Link>} />
    {dashboard.isLoading ? <LoadingPanel /> : dashboard.isError ? <ErrorPanel onRetry={() => dashboard.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: 'Total pages', value: stats.pages, note: `${stats.publishedPages} live`, icon: FileText, tint: 'bg-[#f8dfc9]' }, { label: 'Media assets', value: stats.media, note: 'Across your library', icon: FolderOpen, tint: 'bg-[#e3eee5]' }, { label: 'New submissions', value: stats.submissions, note: 'Needs a reply', icon: MessageSquare, tint: 'bg-[#f7dbaf]' }, { label: 'Site health', value: 'Good', note: 'Last checked just now', icon: Zap, tint: 'bg-[#dce7e5]' }].map(({ label, value, note, icon: Icon, tint }) => <div key={label} data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="group rounded-2xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><div className={cx('flex h-10 w-10 items-center justify-center rounded-xl', tint)}><Icon size={18} /></div><ArrowUpRight size={16} className="text-muted-foreground/50 transition group-hover:text-primary" /></div><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="font-display text-3xl font-semibold">{value}</p><p className="mb-1 text-right text-[11px] text-muted-foreground">{note}</p></div></div>)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_.85fr]"><section className="rounded-2xl border border-card-border bg-card p-6"><div className="mb-6 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your pages</p><h2 className="mt-1 font-display text-2xl">The site at a glance</h2></div><Link href="/admin/pages" data-testid="link-dashboard-pages" className="text-xs font-bold text-primary hover:underline">Manage pages <ChevronRight className="inline" size={14} /></Link></div>{pages.isLoading ? <div className="space-y-3"><div className="skeleton h-14 rounded-xl" /><div className="skeleton h-14 rounded-xl" /></div> : pages.data?.length ? <div className="space-y-2">{pages.data.slice(0, 4).map((page) => <Link href={`/admin/pages/${page.id}`} key={page.id} data-testid={`row-dashboard-page-${page.id}`} className="flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 hover:border-border hover:bg-background"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted font-mono-ui text-xs text-muted-foreground">{String(page.sortOrder + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{page.title}</p><p className="mt-0.5 text-xs text-muted-foreground">/{page.slug} · updated {formatDate(page.updatedAt)}</p></div><StatusPill status={page.status} /><ChevronRight size={15} className="text-muted-foreground" /></Link>)}</div> : <EmptyPanel icon={FileText} title="Your first page is waiting" body="Start with a homepage or bring in a template." action={<Link href="/admin/pages/new" data-testid="link-empty-create-page" className="text-sm font-bold text-primary">Create a page <ArrowUpRight className="inline" size={14} /></Link>} />}</section>
        <section className="studio-grid rounded-2xl border border-card-border bg-[#f7dbaf] p-6 text-[#2b2630]"><div className="flex h-full flex-col"><div className="flex items-center justify-between"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#a64f34]">Studio note</p><Sparkles size={18} className="text-[#a64f34]" /></div><h2 className="mt-12 max-w-xs font-display text-3xl leading-[.95]">A good website is never really finished.</h2><p className="mt-5 text-sm leading-6 text-[#716976]">Keep the useful bits fresh. A new photo, a sharper sentence, a page that answers one more question.</p><div className="mt-auto pt-10"><Link href="/admin/templates" data-testid="link-dashboard-templates" className="inline-flex items-center gap-2 rounded-full bg-[#2b2630] px-4 py-2.5 text-xs font-bold text-[#f7dbaf]">Browse templates <ArrowUpRight size={14} /></Link></div></div></section></div>
      <section className="mt-6 rounded-2xl border border-card-border bg-card p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Recent activity</p><h2 className="mt-1 font-display text-2xl">The paper trail</h2></div><Clock3 size={18} className="text-muted-foreground" /></div>{stats.recentActivity?.length ? <div className="grid gap-3 md:grid-cols-2">{stats.recentActivity.slice(0, 6).map((item) => <div key={item.id} data-testid={`activity-${item.id}`} className="flex gap-3 rounded-xl bg-background p-3"><div className="mt-1 h-2 w-2 rounded-full bg-primary" /><div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.detail} · {formatDate(item.timestamp)}</p></div></div>)}</div> : <p data-testid="text-no-activity" className="text-sm text-muted-foreground">Your next edit will show up here.</p>}</section></>}</div>;
}

function PagesManager() {
  const queryClient = useQueryClient();
  const pages = useListPages({ query: { queryKey: getListPagesQueryKey() } });
  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const publishPage = usePublishPage();
  const [showCreate, setShowCreate] = useState(false);
  const [newPage, setNewPage] = useState({ title: '', slug: '' });
  const [filter, setFilter] = useState('');
  const filtered = (pages.data ?? []).filter((page) => page.title.toLowerCase().includes(filter.toLowerCase()) || page.slug.includes(filter.toLowerCase()));
  const onCreate = (event: FormEvent) => { event.preventDefault(); if (!newPage.title || !newPage.slug) return; createPage.mutate({ data: { ...newPage, status: 'draft', sortOrder: (pages.data?.length ?? 0) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPagesQueryKey() }); setShowCreate(false); setNewPage({ title: '', slug: '' }); } }); };
  return <div className="reveal"><PageHeader eyebrow="Content / Pages" title="Pages" description="Shape the structure of your site. Draft in private, publish when it feels right." action={<Button data-testid="button-open-create-page" onClick={() => setShowCreate(true)}><Plus size={16} /> New page</Button>} />
    {showCreate && <form data-testid="form-create-page" onSubmit={onCreate} className="mb-6 grid gap-4 rounded-2xl border border-primary/30 bg-[#fff6ee] p-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"><Field label="Page title" value={newPage.title} onChange={(title) => setNewPage({ ...newPage, title })} placeholder="About the studio" /><Field label="URL slug" value={newPage.slug} onChange={(slug) => setNewPage({ ...newPage, slug: slug.toLowerCase().replaceAll(' ', '-') })} placeholder="about" /><Button data-testid="button-create-page" type="submit" disabled={createPage.isPending}>{createPage.isPending ? 'Creating…' : 'Create'}</Button><Button data-testid="button-cancel-create-page" type="button" variant="quiet" onClick={() => setShowCreate(false)}>Cancel</Button></form>}
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-pages" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search pages" className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary" /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'page' : 'pages'}</span></div>
    {pages.isLoading ? <LoadingPanel label="Opening your pages" /> : pages.isError ? <ErrorPanel onRetry={() => pages.refetch()} /> : filtered.length === 0 ? <EmptyPanel icon={FileText} title={filter ? 'No pages match' : 'A blank canvas'} body={filter ? 'Try another search term.' : 'Every considered site begins with one clear page.'} action={!filter && <Button data-testid="button-empty-new-page" onClick={() => setShowCreate(true)}><Plus size={15} /> New page</Button>} /> : <div className="overflow-hidden rounded-2xl border border-card-border bg-card"><div className="hidden grid-cols-[1fr_140px_170px_90px] gap-4 border-b border-border bg-muted/50 px-5 py-3 font-mono-ui text-[10px] uppercase tracking-[.13em] text-muted-foreground md:grid"><span>Page</span><span>Status</span><span>Last updated</span><span /></div>{filtered.map((page) => <div key={page.id} data-testid={`row-page-${page.id}`} className="group grid gap-3 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[1fr_140px_170px_90px] md:items-center md:gap-4"><Link href={`/admin/pages/${page.id}`} data-testid={`link-edit-page-${page.id}`} className="min-w-0"><p className="truncate text-sm font-bold group-hover:text-primary">{page.title}</p><p className="mt-1 truncate font-mono-ui text-[11px] text-muted-foreground">/{page.slug}</p></Link><div><StatusPill status={page.status} /></div><p className="text-xs text-muted-foreground">{formatDate(page.updatedAt)}</p><div className="flex items-center gap-1 md:justify-end"><Link href={`/admin/pages/${page.id}`} data-testid={`button-edit-page-${page.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><Pencil size={15} /></Link><button data-testid={`button-toggle-page-${page.id}`} disabled={publishPage.isPending} onClick={() => publishPage.mutate({ pageId: page.id, data: { status: page.status === 'published' ? 'draft' : 'published' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPagesQueryKey() }) })} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title={page.status === 'published' ? 'Unpublish' : 'Publish'}>{page.status === 'published' ? <Code2 size={15} /> : <Globe2 size={15} />}</button><button data-testid={`button-delete-page-${page.id}`} onClick={() => { if (window.confirm(`Delete ${page.title}?`)) deletePage.mutate({ pageId: page.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPagesQueryKey() }) }); }} className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0eb] hover:text-destructive"><Trash2 size={15} /></button></div></div>)}</div>}
  </div>;
}

function PageEditor() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const id = params.id ?? '';
  const isNew = !id || id === 'new';
  const pageQuery = useGetPage(id, { query: { enabled: !isNew, queryKey: getGetPageQueryKey(id) } });
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const publishPage = usePublishPage();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seoDescription, setSeoDescription] = useState('');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => { if (isNew && !initialized) { setInitialized(true); setBlocks([{ id: `block-${Date.now()}`, type: 'hero', data: { eyebrow: 'New page', title: 'A clear idea starts here', body: 'Tell the story your visitors came to hear.', buttonText: 'Learn more' } }]); } else if (pageQuery.data && !initialized) { const page = pageQuery.data; setTitle(page.title); setSlug(page.slug); setStatus(page.status); setBlocks(page.blocks ?? []); setSeoDescription(page.seo?.description ?? ''); setInitialized(true); } }, [isNew, initialized, pageQuery.data]);
  const addBlock = (type: Block['type']) => setBlocks([...blocks, { id: `block-${Date.now()}`, type, data: { heading: `New ${type} block`, body: 'Add a little context here.' } }]);
  const save = () => { const data = { title: title || 'Untitled page', slug: slug || 'untitled-page', blocks, seo: { title: title || 'Untitled page', description: seoDescription } }; if (isNew) createPage.mutate({ data: { ...data, status, sortOrder: 0 } }, { onSuccess: (page) => { queryClient.invalidateQueries({ queryKey: getListPagesQueryKey() }); setLocation(`/admin/pages/${page.id}`); } }); else updatePage.mutate({ pageId: id, data }, { onSuccess: () => queryClient.setQueryData(getGetPageQueryKey(id), (old: Page | undefined) => old ? { ...old, ...data } : old) }); };
  if (!isNew && pageQuery.isLoading) return <LoadingPanel label="Opening page editor" />;
  if (!isNew && pageQuery.isError) return <ErrorPanel onRetry={() => pageQuery.refetch()} />;
  return <div className="reveal"><div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between"><div><Link href="/admin/pages" data-testid="link-back-pages" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary">← All pages</Link><div className="flex items-center gap-3"><h1 data-testid="text-editor-heading" className="font-display text-4xl font-semibold tracking-tight">{isNew ? 'New page' : title || 'Untitled page'}</h1><StatusPill status={status} /></div></div><div className="flex gap-2"><Button data-testid="button-save-page" variant="outline" onClick={save} disabled={createPage.isPending || updatePage.isPending}>{createPage.isPending || updatePage.isPending ? 'Saving…' : 'Save changes'}</Button><Button data-testid="button-publish-page" onClick={() => { if (isNew) save(); else publishPage.mutate({ pageId: id, data: { status: status === 'published' ? 'draft' : 'published' } }, { onSuccess: (page) => { setStatus(page.status); queryClient.setQueryData(getGetPageQueryKey(id), page); queryClient.invalidateQueries({ queryKey: getListPagesQueryKey() }); } }); }}>{status === 'published' ? 'Unpublish' : 'Publish'} <ArrowUpRight size={15} /></Button></div></div>
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4"><section className="rounded-2xl border border-card-border bg-card p-5 md:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Page setup</p><h2 className="mt-1 font-display text-2xl">The essentials</h2></div><span className="font-mono-ui text-[10px] text-muted-foreground">01</span></div><div className="grid gap-4 md:grid-cols-2"><Field label="Page title" value={title} onChange={setTitle} placeholder="About us" /><Field label="URL slug" value={slug} onChange={(value) => setSlug(value.toLowerCase().replaceAll(' ', '-'))} placeholder="about-us" /></div></section>
        <section className="rounded-2xl border border-card-border bg-card p-5 md:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Content blocks</p><h2 className="mt-1 font-display text-2xl">Build the page</h2></div><span className="font-mono-ui text-[10px] text-muted-foreground">{String(blocks.length).padStart(2, '0')}</span></div><div className="space-y-3">{blocks.map((block, index) => <div key={block.id} data-testid={`card-block-${block.id}`} className="rounded-xl border border-border bg-background p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="font-mono-ui text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-muted px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">{block.type}</span></div><button data-testid={`button-remove-block-${block.id}`} onClick={() => setBlocks(blocks.filter((item) => item.id !== block.id))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#fff0eb] hover:text-destructive"><Trash2 size={14} /></button></div><textarea data-testid={`input-block-data-${block.id}`} value={JSON.stringify(block.data, null, 2)} onChange={(event) => { try { const data = JSON.parse(event.target.value); setBlocks(blocks.map((item) => item.id === block.id ? { ...item, data } : item)); } catch { /* Keep the last valid block until JSON is complete. */ } }} rows={4} className="w-full rounded-lg border border-input bg-card p-3 font-mono-ui text-xs leading-5 outline-none focus:border-primary" /></div>)}</div><div className="mt-5 flex flex-wrap gap-2">{(['hero', 'text-image', 'features', 'testimonials', 'faq', 'cta', 'gallery', 'contact', 'rich-text', 'spacer'] as Block['type'][]).map((type) => <button key={type} data-testid={`button-add-block-${type}`} onClick={() => addBlock(type)} className="rounded-full border border-border px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[.1em] text-muted-foreground hover:border-primary hover:text-primary"><Plus size={12} className="mr-1 inline" />{type}</button>)}</div></section></div>
      <aside className="space-y-4"><section className="rounded-2xl border border-card-border bg-card p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Search preview</p><h3 className="mt-4 font-display text-xl">{title || 'Your page title'}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{seoDescription || 'A short description gives search engines — and visitors — a reason to click.'}</p><div className="mt-5 border-t border-border pt-4"><Field label="SEO description" value={seoDescription} onChange={setSeoDescription} placeholder="Describe this page in one sentence." multiline /></div></section><section className="rounded-2xl bg-[#2b2630] p-5 text-[#f7dbaf]"><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#e7a05c]">Editor note</p><p className="mt-4 font-display text-2xl leading-none">Less, but better.</p><p className="mt-3 text-xs leading-5 text-[#aaa1a8]">One clear idea per block keeps a page easy to scan and lovely to use.</p></section></aside></div>
  </div>;
}

const templates = [
  { id: 'modern', name: 'Modernist', description: 'Quiet confidence, precise spacing, a warm editorial rhythm.', color: '#d9644a', sample: 'A considered frame for considered work.' },
  { id: 'classic', name: 'The Classic', description: 'A familiar, welcoming structure that puts your story first.', color: '#2f6b68', sample: 'Built on good taste and good manners.' },
  { id: 'bold', name: 'Big Feeling', description: 'Large type, high contrast, and a little more volume.', color: '#e7a05c', sample: 'Make the first impression count.' },
  { id: 'minimal', name: 'Bare Essentials', description: 'A calm canvas for teams with very clear things to say.', color: '#b9d9c7', sample: 'Nothing extra. Everything intentional.' },
];

function Templates() {
  const queryClient = useQueryClient();
  const siteQuery = useGetSite(SITE_ID, { query: { queryKey: getGetSiteQueryKey(SITE_ID) } });
  const updateSite = useUpdateSite();
  const [selected, setSelected] = useState<string>(siteQuery.data?.template ?? 'modern');
  useEffect(() => { if (siteQuery.data) setSelected(siteQuery.data.template); }, [siteQuery.data]);
  const choose = (id: string) => { setSelected(id); updateSite.mutate({ siteId: SITE_ID, data: { template: id as Site['template'] } }, { onSuccess: (site) => queryClient.setQueryData(getGetSiteQueryKey(SITE_ID), site) }); };
  return <div className="reveal"><PageHeader eyebrow="Appearance / Templates" title="Choose your frame" description="A template sets the tone. Your content makes it yours." /><div className="grid gap-5 lg:grid-cols-2">{templates.map((template, index) => <button key={template.id} data-testid={`button-template-${template.id}`} onClick={() => choose(template.id)} className={cx('group overflow-hidden rounded-2xl border bg-card text-left transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]', selected === template.id ? 'border-primary ring-2 ring-primary/20' : 'border-card-border')}><div className="relative h-48 overflow-hidden p-6" style={{ background: template.color }}><div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border-[20px] border-[#f7dbaf]/45" /><div className="relative flex h-full flex-col justify-between text-[#2b2630]"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em]">0{index + 1} / {template.id}</span><p className="max-w-xs font-display text-3xl leading-[.92]">{template.sample}</p></div>{selected === template.id && <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#2b2630] text-[#f7dbaf]"><Check size={16} /></span>}</div><div className="p-5"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">{template.name}</h2><ChevronRight size={18} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p></div></button>)}</div><div className="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><Sparkles size={16} className="text-primary" /> Selected template updates your live preview instantly. You can change it at any time.</div></div>;
}

function MediaLibrary() {
  const queryClient = useQueryClient();
  const media = useListMedia({ query: { queryKey: getListMediaQueryKey() } });
  const createMedia = useCreateMedia();
  const deleteMedia = useDeleteMedia();
  const [showAdd, setShowAdd] = useState(false);
  const [asset, setAsset] = useState({ name: '', url: '', publicId: '', width: '', height: '' });
  const onAdd = (event: FormEvent) => { event.preventDefault(); if (!asset.name || !asset.url || !asset.publicId) return; createMedia.mutate({ data: { ...asset, resourceType: 'image', width: asset.width ? Number(asset.width) : undefined, height: asset.height ? Number(asset.height) : undefined } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }); setShowAdd(false); setAsset({ name: '', url: '', publicId: '', width: '', height: '' }); } }); };
  return <div className="reveal"><PageHeader eyebrow="Library / Media" title="Media" description="A tidy home for the images, marks, and moving pieces that make the site feel like yours." action={<Button data-testid="button-open-add-media" onClick={() => setShowAdd(true)}><Upload size={16} /> Add asset</Button>} />
    {showAdd && <form data-testid="form-add-media" onSubmit={onAdd} className="mb-6 grid gap-4 rounded-2xl border border-primary/30 bg-[#fff6ee] p-5 md:grid-cols-2"><Field label="Asset name" value={asset.name} onChange={(name) => setAsset({ ...asset, name })} placeholder="Studio exterior" /><Field label="Image URL" value={asset.url} onChange={(url) => setAsset({ ...asset, url })} placeholder="https://…" /><Field label="Public ID" value={asset.publicId} onChange={(publicId) => setAsset({ ...asset, publicId })} placeholder="northstar/studio-exterior" /><div className="flex items-end gap-2"><Button data-testid="button-create-media" type="submit" disabled={createMedia.isPending}>{createMedia.isPending ? 'Adding…' : 'Add to library'}</Button><Button data-testid="button-cancel-media" type="button" variant="quiet" onClick={() => setShowAdd(false)}>Cancel</Button></div></form>}
    {media.isLoading ? <LoadingPanel label="Sorting the library" /> : media.isError ? <ErrorPanel onRetry={() => media.refetch()} /> : !media.data?.length ? <EmptyPanel icon={ImagePlus} title="No media yet" body="Add your first image by URL. It will be ready to use across the site." action={<Button data-testid="button-empty-add-media" onClick={() => setShowAdd(true)}><Plus size={15} /> Add asset</Button>} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{media.data.map((item: Media) => <div key={item.id} data-testid={`card-media-${item.id}`} className="group overflow-hidden rounded-2xl border border-card-border bg-card shadow-[var(--shadow-soft)]"><div className="relative aspect-[4/3] overflow-hidden bg-muted">{item.resourceType === 'image' ? <img src={item.url} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><FileText size={28} /></div>}<button data-testid={`button-delete-media-${item.id}`} onClick={() => { if (window.confirm(`Remove ${item.name}?`)) deleteMedia.mutate({ mediaId: item.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() }) }); }} className="absolute right-3 top-3 rounded-lg bg-[#2b2630]/75 p-2 text-[#f7dbaf] opacity-0 transition group-hover:opacity-100 hover:bg-destructive"><Trash2 size={15} /></button></div><div className="p-4"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 truncate font-mono-ui text-[10px] text-muted-foreground">{item.width ?? '—'} × {item.height ?? '—'} · {formatDate(item.createdAt)}</p></div></div>)}</div>}
  </div>;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const siteQuery = useGetSite(SITE_ID, { query: { queryKey: getGetSiteQueryKey(SITE_ID) } });
  const updateSite = useUpdateSite();
  const [name, setName] = useState(''); const [settings, setSettings] = useState<SiteSettings>(fallbackSite.settings); const [saved, setSaved] = useState(false);
  useEffect(() => { if (siteQuery.data) { setName(siteQuery.data.name); setSettings(siteQuery.data.settings); } }, [siteQuery.data]);
  if (siteQuery.isLoading) return <LoadingPanel label="Loading site settings" />;
  if (siteQuery.isError) return <ErrorPanel onRetry={() => siteQuery.refetch()} />;
  const set = (key: keyof SiteSettings, value: string) => setSettings({ ...settings, [key]: value });
  const save = (event: FormEvent) => { event.preventDefault(); updateSite.mutate({ siteId: SITE_ID, data: { name, settings } }, { onSuccess: (site) => { queryClient.setQueryData(getGetSiteQueryKey(SITE_ID), site); setSaved(true); window.setTimeout(() => setSaved(false), 2500); } }); };
  return <div className="reveal"><PageHeader eyebrow="Workspace / Settings" title="Site settings" description="The practical details behind the polished surface." /><form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_300px]"><div className="space-y-6"><section className="rounded-2xl border border-card-border bg-card p-6"><div className="mb-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Identity</p><h2 className="mt-1 font-display text-2xl">Make it yours</h2></div><div className="grid gap-5 md:grid-cols-2"><Field label="Site name" value={name} onChange={setName} placeholder="Northstar Ceramics" /><Field label="Contact email" value={settings.contactEmail ?? ''} onChange={(value) => set('contactEmail', value)} placeholder="hello@example.com" type="email" /><Field label="Phone" value={settings.phone ?? ''} onChange={(value) => set('phone', value)} placeholder="(415) 555-0148" /><Field label="Address" value={settings.address ?? ''} onChange={(value) => set('address', value)} placeholder="Your studio address" /></div></section><section className="rounded-2xl border border-card-border bg-card p-6"><div className="mb-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Discovery</p><h2 className="mt-1 font-display text-2xl">Help people find you</h2></div><div className="grid gap-5"><Field label="Google Analytics 4 ID" value={settings.ga4MeasurementId ?? ''} onChange={(value) => set('ga4MeasurementId', value)} placeholder="G-XXXXXXXXXX" /><Field label="Instagram handle" value={settings.socialLinks?.instagram ?? ''} onChange={(value) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, instagram: value } })} placeholder="northstarceramics" /></div></section></div><aside className="space-y-4"><section className="rounded-2xl border border-card-border bg-card p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Brand colors</p><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-xs font-semibold"><input data-testid="input-primary-color" type="color" value={settings.primaryColor} onChange={(event) => set('primaryColor', event.target.value)} className="mb-2 h-16 w-full cursor-pointer rounded-xl border-0 bg-transparent" />Primary</label><label className="text-xs font-semibold"><input data-testid="input-accent-color" type="color" value={settings.accentColor} onChange={(event) => set('accentColor', event.target.value)} className="mb-2 h-16 w-full cursor-pointer rounded-xl border-0 bg-transparent" />Accent</label></div></section><section className="rounded-2xl bg-[#2b2630] p-5 text-[#f7dbaf]"><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#e7a05c]">Publishing status</p><p className="mt-4 text-sm leading-6 text-[#aaa1a8]">Changes are saved to your site workspace and reflected on the public preview.</p><Button data-testid="button-save-settings" type="submit" className="mt-5 w-full" disabled={updateSite.isPending}>{updateSite.isPending ? 'Saving…' : saved ? 'Saved' : 'Save settings'} {saved ? <Check size={15} /> : <ArrowUpRight size={15} />}</Button></section></aside></form></div>;
}

function Submissions() {
  const submissions = useListSubmissions({ query: { queryKey: getListSubmissionsQueryKey() } });
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  return <div className="reveal"><PageHeader eyebrow="Inbox / Submissions" title="Submissions" description="Notes from people who found their way to your site." /><div className="grid gap-5 lg:grid-cols-[1fr_360px]">{submissions.isLoading ? <LoadingPanel label="Checking the inbox" /> : submissions.isError ? <ErrorPanel onRetry={() => submissions.refetch()} /> : !submissions.data?.length ? <EmptyPanel icon={MessageSquare} title="The inbox is quiet" body="When someone sends the contact form, their note will land here." /> : <div className="overflow-hidden rounded-2xl border border-card-border bg-card"><div className="border-b border-border bg-muted/50 px-5 py-3 font-mono-ui text-[10px] uppercase tracking-[.13em] text-muted-foreground">{submissions.data.length} messages</div>{submissions.data.map((item) => <button key={item.id} data-testid={`button-submission-${item.id}`} onClick={() => setSelected(item)} className={cx('flex w-full gap-4 border-b border-border px-5 py-4 text-left last:border-0 hover:bg-background', selected?.id === item.id && 'bg-[#fff6ee]')}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8dfc9] text-xs font-bold text-[#a64f34]">{item.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{item.name}</p><StatusPill status={item.status} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{item.message}</p><p className="mt-2 font-mono-ui text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</p></div></button>)}</div>}<aside className="h-fit rounded-2xl border border-card-border bg-card p-6">{selected ? <><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Message detail</p><h2 className="mt-2 font-display text-3xl">{selected.name}</h2></div><button data-testid="button-close-submission" onClick={() => setSelected(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X size={17} /></button></div><a data-testid="link-submission-email" href={`mailto:${selected.email}`} className="mt-2 block text-sm text-primary hover:underline">{selected.email}</a><p data-testid="text-submission-message" className="mt-7 whitespace-pre-wrap text-sm leading-7 text-foreground/80">{selected.message}</p><div className="mt-8 border-t border-border pt-4"><p className="font-mono-ui text-[10px] uppercase tracking-[.13em] text-muted-foreground">Received</p><p className="mt-1 text-sm">{formatDate(selected.createdAt)}</p></div></> : <div className="py-10 text-center"><CircleHelp className="mx-auto text-muted-foreground" size={22} /><p className="mt-4 font-display text-xl">Choose a message</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Select a submission to read the full note.</p></div>}</aside></div></div>;
}

function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('maya@northstarceramics.co'); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (!email || !password) { setError('Enter your email and password to continue.'); return; } if (!supabase) { setError('Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'); return; } const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) { setError(error.message || 'Invalid credentials or expired session.'); return; } queryClient.invalidateQueries(); setLocation('/admin'); };
  return <div className="noise flex min-h-[100dvh] bg-[#2b2630] text-[#f6f0e6]"><div className="hidden w-[42%] flex-col justify-between bg-[#d9644a] p-10 text-[#2b2630] lg:flex"><Link href="/" data-testid="link-login-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 rotate-3 items-center justify-center rounded-xl bg-[#2b2630] text-[#f7dbaf]"><Sparkles size={17} /></span><span className="font-display text-xl font-bold">Site Studio</span></Link><div><p className="mb-5 font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#2b2630]/60">A calm place to publish</p><h1 className="max-w-md font-display text-6xl font-semibold leading-[.88] tracking-[-.06em]">Make the site feel like you.</h1><div className="mt-10 flex items-center gap-3 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-[#2f6b68]" /> Your workspace is ready</div></div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#2b2630]/55">Site Studio / 2024</p></div><main className="flex flex-1 items-center justify-center px-6 py-12 md:px-12"><div className="w-full max-w-md"><Link href="/" data-testid="link-mobile-login-logo" className="mb-14 flex items-center gap-3 lg:hidden"><span className="flex h-9 w-9 rotate-3 items-center justify-center rounded-xl bg-[#d9644a] text-[#2b2630]"><Sparkles size={17} /></span><span className="font-display text-xl font-bold">Site Studio</span></Link><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#e7a05c]">Welcome back</p><h2 className="font-display text-5xl leading-none">Open your studio.</h2><p className="mt-4 text-sm text-[#aaa1a8]">Pick up where you left off.</p><form data-testid="form-login" onSubmit={submit} className="mt-10 space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#aaa1a8]">Email</span><input data-testid="input-login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="w-full rounded-xl border border-[#5c5360] bg-[#342e3a] px-4 py-3.5 text-sm outline-none focus:border-[#d9644a]" /></label><label className="block"><div className="mb-2 flex justify-between"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#aaa1a8]">Password</span><button data-testid="button-forgot-password" type="button" onClick={() => setError('Password reset is available through your account email.')} className="text-xs font-semibold text-[#e7a05c] hover:underline">Forgot password?</button></div><input data-testid="input-login-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Enter your password" className="w-full rounded-xl border border-[#5c5360] bg-[#342e3a] px-4 py-3.5 text-sm outline-none focus:border-[#d9644a]" /></label>{error && <p data-testid="status-login-error" className="rounded-lg bg-[#5c2e2e] px-3 py-2 text-xs text-[#f8c2b1]">{error}</p>}<button data-testid="button-login-submit" type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d9644a] px-5 py-3.5 text-sm font-bold text-[#2b2630] hover:brightness-95">Enter studio <ArrowUpRight size={16} /></button></form><p className="mt-10 text-center text-xs text-[#aaa1a8]">Need a hand? <button data-testid="button-login-support" onClick={() => window.alert('Email support@sitestudio.local for a hand.')} className="font-semibold text-[#e7a05c]">Talk to support</button></p></div></main></div>;
}

function NotFoundView() {
  return <div className="py-20 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">404 / Not found</p><h1 className="mt-4 font-display text-5xl">This page wandered off.</h1><Link href="/admin" data-testid="link-not-found-home" className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Back to studio</Link></div>;
}

function Router() {
  const [location] = useLocation();
  if (location.startsWith('/admin')) return <AdminShell />;
  return <Switch><Route path="/" component={PublicPreview} /><Route path="/login" component={Login} /><Route component={NotFoundView} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;