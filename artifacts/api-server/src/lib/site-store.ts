import type {
  ActivityItem,
  ContactSubmission,
  ContactSubmissionInput,
  DashboardSummary,
  Media,
  MediaInput,
  Page,
  PageInput,
  PageUpdate,
  Site,
  SiteSettings,
  SiteUpdate,
} from "@workspace/api-zod";

const now = () => new Date().toISOString();

const siteSettings: SiteSettings = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#D95D39",
  accentColor: "#2F6B5F",
  fontFamily: "DM Sans",
  contactEmail: "hello@northstar-studio.com",
  phone: "+27 21 555 0198",
  address: "14 Kloof Street, Cape Town",
  ga4MeasurementId: null,
  socialLinks: {
    instagram: "https://instagram.com",
    linkedin: "https://linkedin.com",
  },
};

let site: Site = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Northstar Studio",
  slug: "northstar-studio",
  template: "modern",
  settings: siteSettings,
  updatedAt: now(),
};

let pages: Page[] = [
  {
    id: "00000000-0000-4000-8000-000000000010",
    title: "Home",
    slug: "home",
    status: "published",
    sortOrder: 0,
    blocks: [
      {
        id: "hero-home",
        type: "hero",
        data: {
          eyebrow: "Independent creative studio",
          title: "Make your next chapter visible.",
          body: "Northstar helps thoughtful brands find their clearest voice and bring it to life.",
          primaryCta: "Start a conversation",
          secondaryCta: "Explore our work",
        },
      },
      {
        id: "features-home",
        type: "features",
        data: {
          title: "Clarity, crafted.",
          items: [
            { title: "Brand strategy", body: "A sharper point of view for the road ahead." },
            { title: "Digital experiences", body: "Websites that feel as good as they perform." },
            { title: "Ongoing partnership", body: "A calm, capable team in your corner." },
          ],
        },
      },
      {
        id: "cta-home",
        type: "cta",
        data: {
          title: "Have a good thing in the works?",
          body: "Tell us where you’re headed. We’ll help you map the way.",
          label: "Get in touch",
        },
      },
    ],
    seo: {
      title: "Northstar Studio — Make your next chapter visible",
      description: "A creative studio for thoughtful brands ready for their next chapter.",
      ogImageUrl: null,
      canonicalUrl: null,
    },
    updatedAt: now(),
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    title: "About",
    slug: "about",
    status: "published",
    sortOrder: 1,
    blocks: [
      {
        id: "text-about",
        type: "text-image",
        data: {
          title: "Built for the in-between.",
          body: "We work with people who know their work matters, even when the story around it needs a little more shape.",
        },
      },
    ],
    seo: {
      title: "About Northstar Studio",
      description: "Meet the people behind Northstar Studio.",
      ogImageUrl: null,
      canonicalUrl: null,
    },
    updatedAt: now(),
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    title: "Contact",
    slug: "contact",
    status: "draft",
    sortOrder: 2,
    blocks: [
      {
        id: "contact-contact",
        type: "contact",
        data: {
          title: "Let’s talk about what’s next.",
          body: "Share a little about your project and we’ll get back to you within two working days.",
        },
      },
    ],
    seo: {
      title: "Contact Northstar Studio",
      description: "Start a conversation with Northstar Studio.",
      ogImageUrl: null,
      canonicalUrl: null,
    },
    updatedAt: now(),
  },
];

let media: Media[] = [
  {
    id: "00000000-0000-4000-8000-000000000020",
    name: "Northstar editorial cover",
    publicId: "northstar/editorial-cover",
    url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80",
    resourceType: "image",
    width: 1600,
    height: 1067,
    createdAt: now(),
  },
  {
    id: "00000000-0000-4000-8000-000000000021",
    name: "Workshop detail",
    publicId: "northstar/workshop-detail",
    url: "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=1200&q=80",
    resourceType: "image",
    width: 1200,
    height: 800,
    createdAt: now(),
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    name: "Material study",
    publicId: "northstar/material-study",
    url: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=80",
    resourceType: "image",
    width: 1200,
    height: 800,
    createdAt: now(),
  },
];

let submissions: ContactSubmission[] = [
  {
    id: "00000000-0000-4000-8000-000000000030",
    name: "Maya Daniels",
    email: "maya@example.com",
    message: "We’re preparing to launch a new hospitality concept and would love help shaping the story.",
    status: "new",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000031",
    name: "Aiden Ross",
    email: "aiden@example.com",
    message: "Could you send through your availability for a small brand refresh?",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const activities: ActivityItem[] = [
  {
    id: "activity-1",
    label: "Page published",
    detail: "Home is live on your site",
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    id: "activity-2",
    label: "New submission",
    detail: "Maya Daniels sent a message",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "activity-3",
    label: "Media added",
    detail: "Northstar editorial cover uploaded",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const siteStore = {
  getSite: () => site,
  updateSite: (input: SiteUpdate) => {
    site = {
      ...site,
      ...(input.name ? { name: input.name } : {}),
      ...(input.template ? { template: input.template } : {}),
      ...(input.settings ? { settings: input.settings } : {}),
      updatedAt: now(),
    };
    return site;
  },
  listPages: () => [...pages].sort((a, b) => a.sortOrder - b.sortOrder),
  getPage: (id: string) => pages.find((page) => page.id === id),
  createPage: (input: PageInput) => {
    const page: Page = {
      id: crypto.randomUUID(),
      title: input.title,
      slug: input.slug,
      status: input.status ?? "draft",
      sortOrder: input.sortOrder ?? pages.length,
      blocks: input.blocks ?? [],
      seo: input.seo ?? { title: input.title, description: "" },
      updatedAt: now(),
    };
    pages = [...pages, page];
    return page;
  },
  updatePage: (id: string, input: PageUpdate) => {
    const current = pages.find((page) => page.id === id);
    if (!current) return undefined;
    const updated: Page = { ...current, ...input, updatedAt: now() };
    pages = pages.map((page) => (page.id === id ? updated : page));
    return updated;
  },
  deletePage: (id: string) => {
    const count = pages.length;
    pages = pages.filter((page) => page.id !== id);
    return pages.length !== count;
  },
  publishPage: (id: string, status: Page["status"]) => {
    return siteStore.updatePage(id, { status } as PageUpdate);
  },
  listMedia: () => [...media].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  createMedia: (input: MediaInput) => {
    const asset: Media = { ...input, id: crypto.randomUUID(), createdAt: now() };
    media = [asset, ...media];
    return asset;
  },
  deleteMedia: (id: string) => {
    const count = media.length;
    media = media.filter((item) => item.id !== id);
    return media.length !== count;
  },
  listSubmissions: () => [...submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  createSubmission: (input: ContactSubmissionInput) => {
    const submission: ContactSubmission = {
      ...input,
      id: crypto.randomUUID(),
      status: "new",
      createdAt: now(),
    };
    submissions = [submission, ...submissions];
    return submission;
  },
  getDashboard: (): DashboardSummary => ({
    pages: pages.length,
    publishedPages: pages.filter((page) => page.status === "published").length,
    media: media.length,
    submissions: submissions.filter((submission) => submission.status === "new").length,
    recentActivity: activities,
  }),
  getSiteSettings: (): SiteSettings => site.settings,
  _makeId: makeId,
};