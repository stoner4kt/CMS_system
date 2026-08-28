# Site Studio

Site Studio is a reusable website starter for agencies and independent developers who hand off polished, self-manageable websites to clients. Each client can run the same codebase in an independent repository and Supabase project, while choosing from five template systems and editing multi-page, block-based content without touching code.

## What is included

- Public website preview with template-aware rendering
- Admin workspace for dashboard, pages, blocks, templates, media, settings, SEO, and contact submissions
- Typed API contract in `lib/api-spec/openapi.yaml`
- Seeded preview API so the app is useful before connecting a client database
- Supabase SQL schema with indexes, timestamps, Auth profile trigger, and Row Level Security policies
- Cloudinary-ready media model and signed-upload environment configuration
- SEO-ready page fields for title, description, Open Graph image, and canonical URL
- Cloudflare Pages deployment notes

## Local setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase/schema.sql`.
3. Enable the Email provider in Supabase Auth.
4. Create the first admin user.
5. Run `supabase/seed.sql` to create the example Northstar Studio site.
6. Create a Cloudinary account and set up an upload preset or signed upload credentials.
7. Copy `.env.example` to `.env` and fill in the Supabase and Cloudinary values.
8. Install dependencies with `pnpm install`.
9. Start the local preview from the workspace workflow, or run `pnpm --filter @workspace/site-studio run dev` with `PORT` and `BASE_PATH` set by the workflow.

The preview API is intentionally seeded and in-memory for the first handoff. Replace the store in `artifacts/api-server/src/lib/site-store.ts` with Supabase queries when connecting a client project. Keep the OpenAPI response shapes unchanged so the generated hooks and UI do not need to move.

## Architecture

```text
lib/api-spec/openapi.yaml       API source of truth
lib/api-client-react/            Generated React Query client
lib/api-zod/                     Generated Zod request/response schemas
artifacts/api-server/            Express API and preview store
artifacts/site-studio/           React/Vite app
supabase/schema.sql              Production Supabase schema + RLS
supabase/seed.sql                One example site
```

The public preview uses the same site and page entities as the admin. The client UI calls the typed API hooks; successful mutations invalidate the relevant query so changes remain visible after navigation and reload. The production adapter should derive ownership from the authenticated Supabase session and never accept owner IDs from the browser.

## Templates

Templates are a rendering decision, not a database fork. All templates consume the same `Site`, `Page`, `Block`, and `SiteSettings` shapes. To add or adapt a template:

1. Add a template key to the API enum and the shared template registry.
2. Create a template folder with its own header, footer, page renderer, and block styling.
3. Keep block data portable; avoid putting template-specific content into the database.
4. Add the template to the admin selector and public preview.
5. Add a screenshot or preview route for the template.

The `custom` template is intentionally a clean mapping layer. When migrating an existing client design, start by extracting typography, color tokens, radius, spacing, and imagery into `SiteSettings`. Map each existing section to the closest block type; only create a new block when the content model genuinely cannot express the design. Keep the custom renderer isolated so future template updates do not break the client's site.

## Adding a page or block

Pages contain an ordered `blocks` array and an independent `seo` object. Create a page with a lowercase hyphenated slug, add blocks with stable IDs, edit the block `data`, then publish it. A new block type requires:

1. An enum value in the API schema and Supabase enum.
2. A typed data contract or validated object shape.
3. A renderer in the public template layer.
4. An editor control and preview state.
5. A seed example if it is part of the starter experience.

## Cloudinary

Use signed browser uploads for client media. The server signs the upload parameters with `CLOUDINARY_API_SECRET`; the browser uploads directly to Cloudinary, then registers the returned `public_id`, URL, resource type, and dimensions through `POST /api/media`. Do not expose the API secret to Vite or store media bytes in Postgres.

## Analytics and SEO

The admin stores a GA4 Measurement ID in site settings. The public renderer should only inject the GA4 script when the value matches `G-[A-Z0-9]+`. Use the page SEO object for route-level metadata, Open Graph tags, canonical URLs, structured data, sitemap generation, and `robots.txt` in the production adapter.

## Cloudflare Pages

1. Push the client repository to GitHub.
2. Create a Cloudflare Pages project from the repository.
3. Use the official Next-on-Cloudflare/OpenNext adapter when moving the starter to Next.js 15 App Router. The current workspace preview is Vite-based so it can be iterated on quickly; the domain, Supabase, Cloudinary, and SEO contracts are framework-agnostic.
4. Set the production build command and output directory required by the chosen adapter.
5. Add every variable from `.env.example` in Cloudflare Pages project settings. Keep `SUPABASE_SERVICE_ROLE_KEY` and `CLOUDINARY_API_SECRET` server-only.
6. Deploy a preview branch, test login, public pages, contact submissions, media uploads, and unpublished page visibility.
7. Add the custom domain in Cloudflare Pages, then verify the canonical URL and sitemap on the custom domain.

## Regenerating the API

After changing the contract:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

The workspace uses Zod 4 because the current Orval generator emits Zod 4 helpers. Keep the generated files under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` source-controlled.
## Supabase-backed hand-off setup

Site Studio now expects Supabase to be the system of record for admin data. Apply `supabase/schema.sql` (and the seed SQL when developing with the Northstar demo) before starting the API server.

### Required environment variables

Server-only (`artifacts/api-server`):

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_ANON_KEY` — used only to validate incoming user JWTs.
- `SUPABASE_SERVICE_ROLE_KEY` — used only by the Express API server for ownership-checked data access. Never expose this to the browser.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER` — unchanged Cloudinary signed-upload configuration.

Browser (`artifacts/site-studio`):

- `VITE_SUPABASE_URL` — Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — public anon key for password login and token refresh.

### Auth and multi-site behavior

Admin requests require `Authorization: Bearer <Supabase access token>`. The React app signs in with Supabase email/password, persists and refreshes the session, and the shared API fetcher attaches the current token before each admin request. The API derives ownership from the verified Supabase user id and never accepts `owner_id` from client payloads.

The API supports both the legacy single-site `current` routes and new multi-site routes. Use `GET /api/sites` after login to list sites for the current owner, `POST /api/sites` to create one, and scope pages/media/submissions with `/api/sites/{siteId}/...` where possible. Public contact submissions must include a verified `siteId` path/query value.

### Local verification flow

```bash
pnpm install
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm run build
PORT=3001 SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @workspace/api-server run start
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... PORT=5173 pnpm --filter @workspace/site-studio run dev
```

Then verify: log in at `/login`, create a site with `POST /api/sites`, edit or create a page under `/admin/pages`, publish it, view `/`, submit the contact form with a site id, and export/import content once the backup endpoints are enabled.

### Deployment notes

Keep the service-role key only in the server deployment environment. For Cloudflare Pages, deploy the frontend with the public `VITE_SUPABASE_*` variables and route `/api/*` to the API deployment (or migrate the app to the documented OpenNext adapter in a follow-up). The current Vite build preserves `BASE_PATH`; set it when deploying under a subpath.
