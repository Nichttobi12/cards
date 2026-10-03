begin;
alter table public.portal_accounts drop constraint if exists portal_accounts_slot_check;
alter table public.portal_accounts add column if not exists role text not null default 'user' check(role in ('admin','user'));
alter table public.portal_accounts add column if not exists active boolean not null default true;
update public.portal_accounts set role='admin' where user_id='4e233b35-2893-4211-8439-e8a8c98eeb69' and username='nichttobi';
create table if not exists public.photo_submissions (
 id text primary key,
 owner uuid not null references public.portal_accounts(user_id),
 card_id text not null,
 language text not null check(language in ('de','en','ja','fr','it','es')),
 photo_path text not null,
 card_name text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at text not null,
 reviewed_at text,
 reviewed_by uuid references public.portal_accounts(user_id)
);
create index if not exists idx_photo_submissions_status on public.photo_submissions(status,created_at);
create index if not exists idx_photo_submissions_owner on public.photo_submissions(owner);
alter table public.photo_submissions enable row level security;
revoke all on public.photo_submissions from public,anon,authenticated;
grant all on public.photo_submissions to service_role;
-- Portal tables are accessed through the authenticated server, not writable clients.
revoke insert,update,delete on public.cards,public.collections from anon,authenticated;
commit;
create or replace function public.portal_review_photo(submission_id text, reviewer_id uuid, decision text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.photo_submissions;
begin
 if decision not in ('approved','rejected') or not exists(select 1 from public.portal_accounts where user_id=reviewer_id and role='admin' and active) then raise exception 'Not allowed'; end if;
 select * into item from public.photo_submissions where id=submission_id and status='pending' for update;
 if not found then return jsonb_build_object('ok',false,'alreadyReviewed',true); end if;
 if decision='approved' then
  if not exists(select 1 from public.portal_accounts where user_id=item.owner and active) then raise exception 'Inactive account'; end if;
  insert into public.card_images(id,owner,card_id,language,photo_path,updated_at) values(item.id::uuid,item.owner,item.card_id,item.language,item.photo_path,now())
  on conflict(owner,card_id,language) do update set photo_path=excluded.photo_path,updated_at=excluded.updated_at;
 end if;
 update public.photo_submissions set status=decision,reviewed_by=reviewer_id,reviewed_at=now()::text where id=item.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_review_photo(text,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_review_photo(text,uuid,text) to service_role;
