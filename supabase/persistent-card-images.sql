-- Photos belong to a catalog identity in an account, never to a collection row.
create table if not exists public.card_images (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references auth.users(id) on delete cascade,
 card_id text not null check (card_id ~ '^[a-zA-Z0-9.-]{1,100}$'),
 language text not null check (language in ('de','en','ja','fr','it','es')),
 photo_path text not null,
 updated_at timestamptz not null default now(),
 unique(owner,card_id,language)
);
alter table public.card_images enable row level security;
revoke all on public.card_images from public, anon, authenticated;
grant all on public.card_images to service_role;
-- Preserve existing uploads without moving or deleting any storage object.
insert into public.card_images(owner,card_id,language,photo_path)
select distinct on (owner,card_id,language) owner,card_id,language,photo_path
from public.cards where photo_path is not null
order by owner,card_id,language,fetched desc,id
on conflict(owner,card_id,language) do nothing;
