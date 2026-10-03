-- Schema snapshot. Actual deployments are tracked in Supabase migration history.
-- No account email addresses or passwords are stored in this repository.
create table public.portal_accounts (
 slot smallint primary key,
 role text not null default 'user' check(role in ('admin','user')),
 active boolean not null default true,
 username text not null unique check(username ~ '^[A-Za-z0-9_!$]{3,30}$'),
 email text not null unique check(email=lower(email)),
 user_id uuid unique references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.portal_accounts enable row level security;
revoke all on public.portal_accounts from anon,authenticated;
grant select on public.portal_accounts to authenticated;
grant all on public.portal_accounts to service_role;
create policy account_read_self on public.portal_accounts for select to authenticated using(user_id=(select auth.uid()));
create table public.collections (
 id text primary key,
 owner uuid not null references public.portal_accounts(user_id) on delete restrict,
 name text not null check (length(name) between 1 and 80),
 created text not null,
 unique(id,owner)
);
create index idx_collections_owner on public.collections(owner);
create table public.cards (
 id text primary key,
 owner uuid not null references public.portal_accounts(user_id) on delete restrict,
 collection_id text not null,
 card_id text not null,
 language text not null check (language in ('de','en','ja','fr','it','es')),
 variant text not null,
 condition text not null check (condition in ('NM','EX','GD','LP','PL','PO')),
 quantity integer not null check (quantity between 1 and 9999),
 cost_cents bigint check (cost_cents between 0 and 100000000),
 manual_cents bigint check (manual_cents between 0 and 100000000),
 grading text not null,
 note text not null,
 data text not null,
 fetched text not null,
 foreign key(collection_id,owner) references public.collections(id,owner) on delete restrict
);
create index idx_cards_owner_collection on public.cards(owner,collection_id);
create table public.portfolio_snapshots (
 id text primary key,
 owner uuid not null references public.portal_accounts(user_id) on delete restrict,
 scope text not null,
 day text not null,
 total_cents bigint not null,
 card_count integer not null,
 valued_count integer not null,
 failed integer not null,
 captured text not null,
 unique(owner,scope,day)
);
create index idx_snapshots_owner_scope_day on public.portfolio_snapshots(owner,scope,day);
alter table public.collections enable row level security;
alter table public.cards enable row level security;
alter table public.portfolio_snapshots enable row level security;
revoke all on public.collections, public.cards, public.portfolio_snapshots from anon, authenticated;
grant select on public.collections, public.cards to authenticated;
grant select on public.portfolio_snapshots to authenticated;
grant all on public.collections,public.cards,public.portfolio_snapshots to service_role;
create policy collections_own on public.collections for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy cards_own on public.cards for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy snapshots_own on public.portfolio_snapshots for select to authenticated using (owner=(select auth.uid()));
create table public.login_attempts (id text primary key, attempts integer not null, "window" bigint not null);
create index idx_login_attempts_window on public.login_attempts("window");
create table public.refresh_jobs (owner uuid primary key references public.portal_accounts(user_id),day text not null,cursor integer not null,failed integer not null,complete integer not null check(complete in (0,1)));
create table public.portal_scheduler_secret (id boolean primary key default true check(id), token text not null);
alter table public.login_attempts enable row level security;
alter table public.refresh_jobs enable row level security;
alter table public.portal_scheduler_secret enable row level security;
revoke all on public.login_attempts,public.refresh_jobs,public.portal_scheduler_secret from anon,authenticated;
grant all on public.login_attempts,public.refresh_jobs,public.portal_scheduler_secret to service_role;
create function public.portal_login_attempt(attempt_id text,attempt_window bigint) returns table(attempts integer)
language sql security invoker set search_path='' as $$
 insert into public.login_attempts(id,attempts,"window") values(attempt_id,1,attempt_window)
 on conflict(id) do update set attempts=public.login_attempts.attempts+1
 returning public.login_attempts.attempts;
$$;
revoke all on function public.portal_login_attempt(text,bigint) from public,anon,authenticated;
grant execute on function public.portal_login_attempt(text,bigint) to service_role;
insert into public.portal_scheduler_secret(token) values(gen_random_uuid()::text||gen_random_uuid()::text);
