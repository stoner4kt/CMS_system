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
import { siteStore } from "../lib/site-store";

const router: IRouter = Router();

router.get("/dashboard", (_req, res) => {
  res.json(siteStore.getDashboard());
});

router.get("/sites/:siteId", (req, res) => {
  const { siteId } = GetSiteParams.parse(req.params);
  const site = siteStore.getSite();
  if (siteId !== "current" && site.id !== siteId) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(site);
});

router.patch("/sites/:siteId", (req, res) => {
  const { siteId } = UpdateSiteParams.parse(req.params);
  if (siteId !== "current" && siteStore.getSite().id !== siteId) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(siteStore.updateSite(UpdateSiteBody.parse(req.body)));
});

router.get("/pages", (_req, res) => {
  res.json(siteStore.listPages());
});

router.post("/pages", (req, res) => {
  res.status(201).json(siteStore.createPage(CreatePageBody.parse(req.body)));
});

router.get("/pages/:pageId", (req, res) => {
  const { pageId } = GetPageParams.parse(req.params);
  const page = siteStore.getPage(pageId);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.patch("/pages/:pageId", (req, res) => {
  const { pageId } = UpdatePageParams.parse(req.params);
  const page = siteStore.updatePage(pageId, UpdatePageBody.parse(req.body));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.delete("/pages/:pageId", (req, res) => {
  const { pageId } = DeletePageParams.parse(req.params);
  if (!siteStore.deletePage(pageId)) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.status(204).send();
});

router.post("/pages/:pageId/publish", (req, res) => {
  const { pageId } = PublishPageParams.parse(req.params);
  const page = siteStore.publishPage(pageId, PublishPageBody.parse(req.body).status);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.get("/media", (_req, res) => {
  res.json(siteStore.listMedia());
});

router.post("/media/signature", (_req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    res.status(503).json({ error: "Cloudinary is not configured" });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "site-studio";
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  res.json({ timestamp, signature, apiKey, cloudName, folder });
});

router.post("/media", (req, res) => {
  res.status(201).json(siteStore.createMedia(CreateMediaBody.parse(req.body)));
});

router.delete("/media/:mediaId", (req, res) => {
  const { mediaId } = DeleteMediaParams.parse(req.params);
  if (!siteStore.deleteMedia(mediaId)) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  res.status(204).send();
});

router.get("/submissions", (_req, res) => {
  res.json(siteStore.listSubmissions());
});

router.post("/submissions", (req, res) => {
  res.status(201).json(siteStore.createSubmission(CreateSubmissionBody.parse(req.body)));
});

export default router;