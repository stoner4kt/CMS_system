-- Site Studio schema for Supabase
-- Run this in Supabase SQL Editor before using a client project.

create extension if not exists "pgcrypto";

create type public.site_template as enum ('modern', 'classic', 'bold', 'minimal', 'custom');
create type public.page_status as enum ('draft', 'published');
create type public.media_resource_type as enum ('image', 'video', 'raw');
create type public.submission_status as enum ('new', 'read', 'archived');
create type public.block_type as enum (
  'hero', 'text-image', 'features', 'testimonials', 'faq',
  'cta', 'gallery', 'contact', 'rich-text', 'spacer'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  template public.site_template not null default 'modern',
  settings jsonb not null default jsonb_build_object(
    'logoUrl', null,
    'faviconUrl', null,
    'primaryColor', '#D95D39',
    'accentColor', '#2F6B5F',
    'fontFamily', 'DM Sans',
    'contactEmail', null,
    'phone', null,
    'address', null,
    'ga4MeasurementId', null,
    'socialLinks', '{}'::jsonb
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.page_status not null default 'draft',
  sort_order integer not null default 0,
  seo jsonb not null default jsonb_build_object(
    'title', '',
    'description', '',
    'ogImageUrl', null,
    'canonicalUrl', null
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  block_type public.block_type not null,
  sort_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  public_id text not null,
  url text not null,
  resource_type public.media_resource_type not null default 'image',
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
  message text not null,
  status public.submission_status not null default 'new',
  created_at timestamptz not null default now()
);

create index sites_owner_id_idx on public.sites(owner_id);
create index pages_site_id_sort_order_idx on public.pages(site_id, sort_order);
create index page_blocks_page_id_sort_order_idx on public.page_blocks(page_id, sort_order);
create index media_site_id_created_at_idx on public.media(site_id, created_at desc);
create index contact_submissions_site_id_created_at_idx on public.contact_submissions(site_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
create trigger sites_set_updated_at before update on public.sites
for each row execute procedure public.set_updated_at();
create trigger pages_set_updated_at before update on public.pages
for each row execute procedure public.set_updated_at();
create trigger page_blocks_set_updated_at before update on public.page_blocks
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.pages enable row level security;
alter table public.page_blocks enable row level security;
alter table public.media enable row level security;
alter table public.contact_submissions enable row level security;

create or replace function public.owns_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sites
    where id = target_site_id and owner_id = auth.uid()
  );
$$;

create policy "Users can read their profile"
  on public.profiles for select
  using (id = auth.uid());
create policy "Users can update their profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Owners can read sites"
  on public.sites for select
  using (owner_id = auth.uid());
create policy "Owners can create sites"
  on public.sites for insert
  with check (owner_id = auth.uid());
create policy "Owners can update sites"
  on public.sites for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "Owners can delete sites"
  on public.sites for delete
  using (owner_id = auth.uid());

create policy "Owners can manage pages"
  on public.pages for all
  using (public.owns_site(site_id))
  with check (public.owns_site(site_id));
create policy "Owners can manage page blocks"
  on public.page_blocks for all
  using (exists (
    select 1 from public.pages
    where pages.id = page_blocks.page_id
      and public.owns_site(pages.site_id)
  ))
  with check (exists (
    select 1 from public.pages
    where pages.id = page_blocks.page_id
      and public.owns_site(pages.site_id)
  ));
create policy "Owners can manage media"
  on public.media for all
  using (public.owns_site(site_id))
  with check (public.owns_site(site_id));
create policy "Owners can read submissions"
  on public.contact_submissions for select
  using (public.owns_site(site_id));
create policy "Public can create submissions"
  on public.contact_submissions for insert
  with check (true);
create policy "Owners can update submissions"
  on public.contact_submissions for update
  using (public.owns_site(site_id))
  with check (public.owns_site(site_id));