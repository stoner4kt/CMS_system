# Site Studio

A reusable multi-client website platform with template-based public sites and a self-serve admin workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
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
- `artifacts/api-server/` — typed Express API and seeded preview store
- `lib/api-spec/openapi.yaml` — API source of truth
- `supabase/schema.sql` — production schema and RLS
- `supabase/seed.sql` — example Northstar Studio content

## Architecture decisions

- The first preview uses an in-memory seeded store so the product is usable before a client connects Supabase.
- Production ownership must be derived from the Supabase Auth session; browser input must never choose `owner_id`.
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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
