-- Example site seed. Run after creating the first Supabase Auth user.
-- The first auth user becomes the owner of the example site.

do $$
declare
  seed_owner uuid;
  seed_site uuid;
  home_page uuid;
begin
  select id into seed_owner from auth.users order by created_at asc limit 1;
  if seed_owner is null then
    raise exception 'Create the first Auth user before running seed.sql';
  end if;

  insert into public.sites (owner_id, name, slug, template, settings)
  values (
    seed_owner,
    'Northstar Studio',
    'northstar-studio',
    'modern',
    jsonb_build_object(
      'primaryColor', '#D95D39',
      'accentColor', '#2F6B5F',
      'fontFamily', 'DM Sans',
      'contactEmail', 'hello@northstar-studio.com',
      'phone', '+27 21 555 0198',
      'address', '14 Kloof Street, Cape Town',
      'socialLinks', jsonb_build_object(
        'instagram', 'https://instagram.com',
        'linkedin', 'https://linkedin.com'
      )
    )
  )
  on conflict (slug) do update set owner_id = excluded.owner_id
  returning id into seed_site;

  insert into public.pages (site_id, title, slug, status, sort_order, seo)
  values (
    seed_site,
    'Home',
    'home',
    'published',
    0,
    jsonb_build_object(
      'title', 'Northstar Studio — Make your next chapter visible',
      'description', 'A creative studio for thoughtful brands ready for their next chapter.'
    )
  )
  on conflict (site_id, slug) do update set status = excluded.status
  returning id into home_page;

  delete from public.page_blocks where page_id = home_page;
  insert into public.page_blocks (page_id, block_type, sort_order, data)
  values
    (home_page, 'hero', 0, jsonb_build_object(
      'eyebrow', 'Independent creative studio',
      'title', 'Make your next chapter visible.',
      'body', 'Northstar helps thoughtful brands find their clearest voice and bring it to life.',
      'primaryCta', 'Start a conversation',
      'secondaryCta', 'Explore our work'
    )),
    (home_page, 'features', 1, jsonb_build_object(
      'title', 'Clarity, crafted.',
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Brand strategy', 'body', 'A sharper point of view for the road ahead.'),
        jsonb_build_object('title', 'Digital experiences', 'body', 'Websites that feel as good as they perform.'),
        jsonb_build_object('title', 'Ongoing partnership', 'body', 'A calm, capable team in your corner.')
      )
    )),
    (home_page, 'cta', 2, jsonb_build_object(
      'title', 'Have a good thing in the works?',
      'body', 'Tell us where you’re headed. We’ll help you map the way.',
      'label', 'Get in touch'
    ));
end $$;