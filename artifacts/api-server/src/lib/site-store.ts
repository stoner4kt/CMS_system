import type {
  ActivityItem,
  Block,
  ContactSubmission,
  ContactSubmissionInput,
  DashboardSummary,
  Media,
  MediaInput,
  Page,
  PageInput,
  PageUpdate,
  Site,
  SiteUpdate,
} from "@workspace/api-zod";
import { getSupabaseAdmin } from "./supabase";

const iso = (value: string | null | undefined) => value ?? new Date().toISOString();
const notNull = <T>(value: T | null | undefined, fallback: T): T => value ?? fallback;

type DbSite = { id: string; name: string; slug: string; template: Site["template"]; settings: Site["settings"]; updated_at: string };
type DbPage = { id: string; title: string; slug: string; status: Page["status"]; sort_order: number; seo: Page["seo"]; updated_at: string; page_blocks?: DbBlock[] };
type DbBlock = { id: string; block_type: Block["type"]; sort_order: number; data: Block["data"] };
type DbMedia = { id: string; name: string; public_id: string; url: string; resource_type: Media["resourceType"]; width: number | null; height: number | null; created_at: string };
type DbSubmission = { id: string; name: string; email: string; message: string; status: ContactSubmission["status"]; created_at: string };

const siteFromDb = (row: DbSite): Site => ({ id: row.id, name: row.name, slug: row.slug, template: row.template, settings: row.settings, updatedAt: iso(row.updated_at) });
const blocksFromDb = (rows: DbBlock[] = []): Block[] => rows.sort((a, b) => a.sort_order - b.sort_order).map((row) => ({ id: row.id, type: row.block_type, data: row.data }));
const pageFromDb = (row: DbPage): Page => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, sortOrder: row.sort_order, blocks: blocksFromDb(row.page_blocks), seo: row.seo, updatedAt: iso(row.updated_at) });
const mediaFromDb = (row: DbMedia): Media => ({ id: row.id, name: row.name, publicId: row.public_id, url: row.url, resourceType: row.resource_type, width: row.width, height: row.height, createdAt: iso(row.created_at) });
const submissionFromDb = (row: DbSubmission): ContactSubmission => ({ id: row.id, name: row.name, email: row.email, message: row.message, status: row.status, createdAt: iso(row.created_at) });

const assertData = <T>(data: T | null, error: { message: string } | null): T => {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Supabase returned no data");
  return data;
};

const siteQuery = async (userId: string, siteId = "current") => {
  const query = (await getSupabaseAdmin()).from("sites").select("id,name,slug,template,settings,updated_at").eq("owner_id", userId);
  return siteId === "current" ? query.order("updated_at", { ascending: false }).limit(1).maybeSingle() : query.eq("id", siteId).maybeSingle();
};

export const siteStore = {
  async listSites(userId: string) {
    const { data, error } = await (await getSupabaseAdmin()).from("sites").select("id,name,slug,template,settings,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false });
    return assertData(data as DbSite[] | null, error).map(siteFromDb);
  },
  async getSite(userId: string, siteId = "current") {
    const { data, error } = await siteQuery(userId, siteId);
    return error ? undefined : data ? siteFromDb(data as DbSite) : undefined;
  },
  async createSite(userId: string, input: { name: string; slug: string; template?: Site["template"]; settings?: Site["settings"] }) {
    const { data, error } = await (await getSupabaseAdmin()).from("sites").insert({ owner_id: userId, name: input.name, slug: input.slug, template: input.template ?? "modern", settings: input.settings ?? {} }).select("id,name,slug,template,settings,updated_at").single();
    return siteFromDb(assertData(data as DbSite | null, error));
  },
  async updateSite(userId: string, siteId: string, input: SiteUpdate) {
    const site = await this.getSite(userId, siteId);
    if (!site) return undefined;
    const { data, error } = await (await getSupabaseAdmin()).from("sites").update({ ...input, updated_at: new Date().toISOString() }).eq("id", site.id).eq("owner_id", userId).select("id,name,slug,template,settings,updated_at").single();
    return siteFromDb(assertData(data as DbSite | null, error));
  },
  async listPages(userId: string, siteId = "current", publishedOnly = false) {
    const site = await this.getSite(userId, siteId);
    if (!site) return [];
    let query = (await getSupabaseAdmin()).from("pages").select("id,title,slug,status,sort_order,seo,updated_at,page_blocks(id,block_type,sort_order,data)").eq("site_id", site.id).order("sort_order", { ascending: true });
    if (publishedOnly) query = query.eq("status", "published");
    const { data, error } = await query;
    return assertData(data as DbPage[] | null, error).map(pageFromDb);
  },
  async getPage(userId: string, pageId: string) {
    const { data, error } = await (await getSupabaseAdmin()).from("pages").select("id,title,slug,status,sort_order,seo,updated_at,page_blocks(id,block_type,sort_order,data),sites!inner(owner_id)").eq("id", pageId).eq("sites.owner_id", userId).maybeSingle();
    return error || !data ? undefined : pageFromDb(data as DbPage);
  },
  async createPage(userId: string, siteId: string, input: PageInput) {
    const site = await this.getSite(userId, siteId);
    if (!site) return undefined;
    const { data, error } = await (await getSupabaseAdmin()).from("pages").insert({ site_id: site.id, title: input.title, slug: input.slug, status: input.status ?? "draft", sort_order: input.sortOrder ?? 0, seo: input.seo ?? { title: input.title, description: "" } }).select("id,title,slug,status,sort_order,seo,updated_at").single();
    const page = pageFromDb(assertData(data as DbPage | null, error));
    if (input.blocks?.length) await this.replaceBlocks(page.id, input.blocks);
    return (await this.getPage(userId, page.id)) ?? page;
  },
  async replaceBlocks(pageId: string, blocks: Block[]) {
    const supabase = await getSupabaseAdmin();
    await supabase.from("page_blocks").delete().eq("page_id", pageId);
    if (!blocks.length) return;
    const { error } = await supabase.from("page_blocks").insert(blocks.map((block, index) => ({ id: crypto.randomUUID(), page_id: pageId, block_type: block.type, sort_order: index, data: block.data })));
    if (error) throw new Error(error.message);
  },
  async updatePage(userId: string, id: string, input: PageUpdate) {
    const current = await this.getPage(userId, id);
    if (!current) return undefined;
    if (input.blocks) await this.replaceBlocks(id, input.blocks);
    const { blocks, sortOrder, ...rest } = input;
    const patch = { ...rest, ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}), updated_at: new Date().toISOString() };
    const { error } = await (await getSupabaseAdmin()).from("pages").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return this.getPage(userId, id);
  },
  async deletePage(userId: string, id: string) { const page = await this.getPage(userId, id); if (!page) return false; const { error } = await (await getSupabaseAdmin()).from("pages").delete().eq("id", id); if (error) throw new Error(error.message); return true; },
  async publishPage(userId: string, id: string, status: Page["status"]) { return this.updatePage(userId, id, { status } as PageUpdate); },
  async listMedia(userId: string, siteId = "current") { const site = await this.getSite(userId, siteId); if (!site) return []; const { data, error } = await (await getSupabaseAdmin()).from("media").select("id,name,public_id,url,resource_type,width,height,created_at").eq("site_id", site.id).order("created_at", { ascending: false }); return assertData(data as DbMedia[] | null, error).map(mediaFromDb); },
  async createMedia(userId: string, siteId: string, input: MediaInput) { const site = await this.getSite(userId, siteId); if (!site) return undefined; const { data, error } = await (await getSupabaseAdmin()).from("media").insert({ site_id: site.id, name: input.name, public_id: input.publicId, url: input.url, resource_type: input.resourceType, width: notNull(input.width, null), height: notNull(input.height, null) }).select("id,name,public_id,url,resource_type,width,height,created_at").single(); return mediaFromDb(assertData(data as DbMedia | null, error)); },
  async deleteMedia(userId: string, id: string) { const { data } = await (await getSupabaseAdmin()).from("media").select("id,sites!inner(owner_id)").eq("id", id).eq("sites.owner_id", userId).maybeSingle(); if (!data) return false; const { error } = await (await getSupabaseAdmin()).from("media").delete().eq("id", id); if (error) throw new Error(error.message); return true; },
  async listSubmissions(userId: string, siteId = "current") { const site = await this.getSite(userId, siteId); if (!site) return []; const { data, error } = await (await getSupabaseAdmin()).from("contact_submissions").select("id,name,email,message,status,created_at").eq("site_id", site.id).order("created_at", { ascending: false }); return assertData(data as DbSubmission[] | null, error).map(submissionFromDb); },
  async createSubmission(siteId: string, input: ContactSubmissionInput) { const { data, error } = await (await getSupabaseAdmin()).from("contact_submissions").insert({ site_id: siteId, name: input.name, email: input.email, message: input.message, status: "new" }).select("id,name,email,message,status,created_at").single(); return submissionFromDb(assertData(data as DbSubmission | null, error)); },
  async getDashboard(userId: string, siteId = "current"): Promise<DashboardSummary> { const [pages, media, submissions] = await Promise.all([this.listPages(userId, siteId), this.listMedia(userId, siteId), this.listSubmissions(userId, siteId)]); const recentActivity: ActivityItem[] = submissions.slice(0, 5).map((s) => ({ id: s.id, label: "New submission", detail: `${s.name} sent a message`, timestamp: s.createdAt })); return { pages: pages.length, publishedPages: pages.filter((p) => p.status === "published").length, media: media.length, submissions: submissions.filter((s) => s.status === "new").length, recentActivity }; },
};
