import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import {
  CreateMediaBody,
  CreatePageBody,
  CreateSubmissionBody,
  DeleteMediaParams,
  DeletePageParams,
  GetPageParams,
  GetSiteParams,
  PublishPageBody,
  PublishPageParams,
  UpdatePageBody,
  UpdatePageParams,
  UpdateSiteBody,
  UpdateSiteParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { siteStore } from "../lib/site-store";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const templates = new Set(["modern", "classic", "bold", "minimal", "custom"]);
const parseCreateSiteBody = (body: Record<string, unknown>) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const template = typeof body.template === "string" && templates.has(body.template) ? body.template : undefined;
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid site name or slug");
  return { name, slug, template: template as undefined | "modern" | "classic" | "bold" | "minimal" | "custom", settings: typeof body.settings === "object" && body.settings ? body.settings as never : undefined };
};
const queryString = (value: unknown) => typeof value === "string" ? value : undefined;
const paramString = (value: unknown) => typeof value === "string" ? value : undefined;
const requestSiteId = (req: { params: Record<string, unknown>; query: Record<string, unknown> }) => paramString(req.params.siteId) ?? queryString(req.query.siteId) ?? "current";

const userId = (req: { user?: { id: string } }) => req.user?.id ?? "";
const submissionAttempts = new Map<string, { count: number; resetAt: number }>();
const submissionWindowMs = 15 * 60 * 1000;
const maxSubmissionsPerWindow = 5;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const parsePublicSubmission = (body: Record<string, unknown>) => {
  if (typeof body.website === "string" && body.website.trim()) return { spam: true as const };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (name.length < 1 || name.length > 120) throw new Error("Name must be between 1 and 120 characters");
  if (!emailPattern.test(email) || email.length > 254) throw new Error("Enter a valid email address");
  if (message.length < 1 || message.length > 5000) throw new Error("Message must be between 1 and 5000 characters");
  return { input: { name, email, message } };
};

const allowSubmission = (ip: string) => {
  const now = Date.now();
  const current = submissionAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    submissionAttempts.set(ip, { count: 1, resetAt: now + submissionWindowMs });
    return true;
  }
  if (current.count >= maxSubmissionsPerWindow) return false;
  current.count += 1;
  return true;
};

router.get("/public/sites/:siteSlug", async (req, res, next) => {
  try {
    const slug = paramString(req.params.siteSlug);
    if (!slug) return res.status(400).json({ error: "site slug is required" });
    const site = await siteStore.getPublicSite(slug);
    if (!site) return res.status(404).json({ error: "Public site not found" });
    res.json(site);
  } catch (error) {
    next(error);
  }
});

router.get("/public/sites/:siteSlug/pages", async (req, res, next) => {
  try {
    const slug = paramString(req.params.siteSlug);
    if (!slug) return res.status(400).json({ error: "site slug is required" });
    const site = await siteStore.getPublicSite(slug);
    if (!site) return res.status(404).json({ error: "Public site not found" });
    res.json(await siteStore.listPublicPages(slug));
  } catch (error) {
    next(error);
  }
});

router.post("/public/sites/:siteSlug/submissions", async (req, res, next) => {
  try {
    const slug = paramString(req.params.siteSlug);
    if (!slug) return res.status(400).json({ error: "site slug is required" });
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!allowSubmission(ip)) {
      res.status(429).json({ error: "Too many messages. Please try again later." });
      return;
    }
    const parsed = parsePublicSubmission(req.body);
    if ("spam" in parsed) {
      logger.warn({ ip, siteSlug: slug }, "Rejected honeypot contact submission");
      res.status(202).json({ accepted: true });
      return;
    }
    const submission = await siteStore.createPublicSubmission(slug, parsed.input);
    if (!submission) return res.status(404).json({ error: "Public site not found" });
    res.status(201).json(submission);
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.get("/dashboard", requireAuth, async (req, res, next) => { try { res.json(await siteStore.getDashboard(userId(req), (queryString(req.query.siteId) ?? "current"))); } catch (error) { next(error); } });

router.get("/sites", requireAuth, async (req, res, next) => { try { res.json(await siteStore.listSites(userId(req))); } catch (error) { next(error); } });
router.post("/sites", requireAuth, async (req, res, next) => { try { res.status(201).json(await siteStore.createSite(userId(req), parseCreateSiteBody(req.body))); } catch (error) { next(error); } });

router.get("/sites/:siteId", requireAuth, async (req, res, next) => { try { const { siteId } = GetSiteParams.parse(req.params); const site = await siteStore.getSite(userId(req), siteId); if (!site) return res.status(404).json({ error: "Site not found" }); res.json(site); } catch (error) { next(error); } });
router.patch("/sites/:siteId", requireAuth, async (req, res, next) => { try { const { siteId } = UpdateSiteParams.parse(req.params); const site = await siteStore.updateSite(userId(req), siteId, UpdateSiteBody.parse(req.body)); if (!site) return res.status(404).json({ error: "Site not found" }); res.json(site); } catch (error) { next(error); } });
router.get("/sites/:siteId/export", requireAuth, async (req, res, next) => {
  try {
    const siteId = paramString(req.params.siteId) ?? "current";
    const includeSubmissions = queryString(req.query.includeSubmissions) === "true";
    const backup = await siteStore.exportSite(userId(req), siteId, includeSubmissions);
    if (!backup) return res.status(404).json({ error: "Site not found" });
    res.setHeader("Content-Disposition", `attachment; filename="${backup.site.slug}-backup.json"`);
    res.type("application/json").send(JSON.stringify(backup, null, 2));
  } catch (error) {
    next(error);
  }
});

router.get(["/pages", "/sites/:siteId/pages"], requireAuth, async (req, res, next) => { try { const siteId = requestSiteId(req); res.json(await siteStore.listPages(userId(req), siteId)); } catch (error) { next(error); } });
router.post(["/pages", "/sites/:siteId/pages"], requireAuth, async (req, res, next) => { try { const siteId = requestSiteId(req); const page = await siteStore.createPage(userId(req), siteId, CreatePageBody.parse(req.body)); if (!page) return res.status(404).json({ error: "Site not found" }); res.status(201).json(page); } catch (error) { next(error); } });

router.get("/pages/:pageId", requireAuth, async (req, res, next) => { try { const { pageId } = GetPageParams.parse(req.params); const page = await siteStore.getPage(userId(req), pageId); if (!page) return res.status(404).json({ error: "Page not found" }); res.json(page); } catch (error) { next(error); } });
router.patch("/pages/:pageId", requireAuth, async (req, res, next) => { try { const { pageId } = UpdatePageParams.parse(req.params); const page = await siteStore.updatePage(userId(req), pageId, UpdatePageBody.parse(req.body)); if (!page) return res.status(404).json({ error: "Page not found" }); res.json(page); } catch (error) { next(error); } });
router.delete("/pages/:pageId", requireAuth, async (req, res, next) => { try { const { pageId } = DeletePageParams.parse(req.params); if (!(await siteStore.deletePage(userId(req), pageId))) return res.status(404).json({ error: "Page not found" }); res.status(204).send(); } catch (error) { next(error); } });
router.post("/pages/:pageId/publish", requireAuth, async (req, res, next) => { try { const { pageId } = PublishPageParams.parse(req.params); const page = await siteStore.publishPage(userId(req), pageId, PublishPageBody.parse(req.body).status); if (!page) return res.status(404).json({ error: "Page not found" }); res.json(page); } catch (error) { next(error); } });

router.get(["/media", "/sites/:siteId/media"], requireAuth, async (req, res, next) => { try { res.json(await siteStore.listMedia(userId(req), requestSiteId(req))); } catch (error) { next(error); } });
router.post("/media/signature", requireAuth, (_req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !apiKey || !apiSecret) return res.status(503).json({ error: "Cloudinary is not configured" });
  const timestamp = Math.floor(Date.now() / 1000); const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "site-studio";
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  res.json({ timestamp, signature, apiKey, cloudName, folder });
});
router.post(["/media", "/sites/:siteId/media"], requireAuth, async (req, res, next) => { try { const media = await siteStore.createMedia(userId(req), requestSiteId(req), CreateMediaBody.parse(req.body)); if (!media) return res.status(404).json({ error: "Site not found" }); res.status(201).json(media); } catch (error) { next(error); } });
router.delete("/media/:mediaId", requireAuth, async (req, res, next) => { try { const { mediaId } = DeleteMediaParams.parse(req.params); if (!(await siteStore.deleteMedia(userId(req), mediaId))) return res.status(404).json({ error: "Media not found" }); res.status(204).send(); } catch (error) { next(error); } });

router.get(["/submissions", "/sites/:siteId/submissions"], requireAuth, async (req, res, next) => { try { res.json(await siteStore.listSubmissions(userId(req), requestSiteId(req))); } catch (error) { next(error); } });
router.post(["/sites/:siteId/submissions", "/submissions"], async (req, res, next) => {
  try {
    const siteId = paramString(req.params.siteId) ?? queryString(req.query.siteId);
    if (!siteId) {
      res.status(400).json({ error: "siteId is required" });
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!allowSubmission(ip)) {
      res.status(429).json({ error: "Too many messages. Please try again later." });
      return;
    }
    const parsed = parsePublicSubmission(req.body);
    if ("spam" in parsed) {
      logger.warn({ ip, siteId }, "Rejected honeypot contact submission");
      res.status(202).json({ accepted: true });
      return;
    }
    res.status(201).json(await siteStore.createSubmission(siteId, parsed.input));
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be")) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
