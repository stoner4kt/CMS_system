# Site Studio

A reusable multi-client website platform with template-based public sites and a self-serve admin workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (workflow supplies `PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Server env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- Browser env: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Optional server env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CLOUDINARY_UPLOAD_FOLDER`
- `pnpm --filter @workspace/site-studio run dev` — run the web app (workflow supplies `PORT` and `BASE_PATH`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + generated React Query hooks

## Where things live

- `artifacts/site-studio/` — public preview and admin workspace
- `artifacts/api-server/` — typed Express API and Supabase-backed store
- `lib/api-spec/openapi.yaml` — API source of truth
- `supabase/schema.sql` — production schema and RLS
- `supabase/seed.sql` — example Northstar Studio content

## Architecture decisions

- Admin data is stored in Supabase. Admin routes require a verified Supabase bearer token and derive ownership from `auth.uid()`; browser input must never choose `owner_id`.
- Public previews resolve a site by slug through `/api/public/sites/:siteSlug`; the local preview uses `?site=<slug>` and falls back to the bundled Northstar example when Supabase is not configured.
- Contact submissions are protected by a five-per-IP per fifteen-minute limiter, a honeypot, and server-side length/email validation.
- Admin settings can download a JSON backup of the selected site's pages, blocks, media metadata, and optional submissions.
- Templates share a portable block data model; visual differences live in template renderers.
- Dates stay as ISO strings across the API boundary to match JSON and generated client types.
- Zod 4 is required because the current Orval generator emits Zod 4 helpers.

## Product

- Clients can preview a public site and manage its pages, templates, media, brand settings, SEO, and inbound contact submissions from one workspace.

## User preferences

No additional user preferences recorded.

## Gotchas

- Regenerate API client and Zod schemas after editing `lib/api-spec/openapi.yaml`.
- Keep Cloudinary API secrets server-only; browsers receive signed upload parameters only.
- Cloudinary media registered through the API is stored with an optimized `f_auto,q_auto` delivery URL when the cloud name is configured.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
