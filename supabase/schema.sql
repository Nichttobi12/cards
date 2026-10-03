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

-- Server-only cache for explicitly language-scoped Cardmarket offers.
create table if not exists public.market_quotes (id text primary key,data jsonb not null,updated_at timestamptz not null default now());
alter table public.market_quotes enable row level security;
revoke all on public.market_quotes from anon, authenticated;
grant all on public.market_quotes to service_role;

create table public.price_submissions (
 id text primary key, owner uuid not null references public.portal_accounts(user_id), row_id text not null,
 card_id text not null, card_name text not null, language text not null check(language in ('de','en','ja','fr','it','es')),
 variant text not null, condition text not null check(condition='NM'), price_cents bigint not null check(price_cents between 1 and 100000000),
 source_url text not null, observed_on date not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_by uuid, reviewed_at timestamptz
);
create index price_submissions_pending on public.price_submissions(status,created_at);
alter table public.price_submissions enable row level security;
revoke all on public.price_submissions from anon,authenticated;
grant all on public.price_submissions to service_role;
create or replace function public.portal_review_price(submission_id text,reviewer_id uuid,decision text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s public.price_submissions; q jsonb; shared jsonb;
begin
 if not exists(select 1 from public.portal_accounts where user_id=reviewer_id and role='admin' and active) then raise exception 'Admin required'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into s from public.price_submissions where id=submission_id for update;
 if not found then raise exception 'Submission missing'; end if;
 if s.status<>'pending' then return jsonb_build_object('alreadyReviewed',true); end if;
 update public.price_submissions set status=decision,reviewed_by=reviewer_id,reviewed_at=now() where id=s.id;
 if decision='approved' then
 q=jsonb_build_object('price',s.price_cents/100.0,'language',s.language,'variant',s.variant,'condition','NM','scope','language','metric','asking-low','source','Cardmarket · manuell geprüft','manualApproved',true,'updated',s.observed_on,'fetchedAt',now(),'sourceUrl',s.source_url);
 insert into public.market_quotes(id,data,updated_at) values(s.card_id||'/'||s.language,jsonb_build_object('marketLanguage',s.language,'languagePriceStatus','available','languageMarketQuotes',jsonb_build_object(s.variant,q)),now())
 on conflict(id) do update set data=market_quotes.data || jsonb_build_object('marketLanguage',s.language,'languagePriceStatus','available','languageMarketQuotes',coalesce(market_quotes.data->'languageMarketQuotes','{}'::jsonb)||jsonb_build_object(s.variant,q)),updated_at=now()
 returning data into shared;
 update public.cards set data=((data::jsonb - 'personalMarketQuote') || shared)::text where card_id=s.card_id and language=s.language and variant=s.variant and condition='NM';
 else
 update public.cards set data=jsonb_set(data::jsonb,'{personalMarketQuote,status}','"rejected"'::jsonb)::text where owner=s.owner and data::jsonb->'personalMarketQuote'->>'submissionId'=s.id;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_review_price(text,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_review_price(text,uuid,text) to service_role;

alter table public.collections add column kind text not null default 'cards' check(kind in ('cards','sealed'));
create table public.sealed_items (
 id text primary key, owner uuid not null references public.portal_accounts(user_id),collection_id text not null,
 product_id text not null,quantity integer not null check(quantity between 1 and 9999),
 cost_cents bigint check(cost_cents between 0 and 100000000),value_cents bigint check(value_cents between 0 and 100000000),
 condition text not null check(condition in ('Originalversiegelt','Folie beschädigt','Verpackung beschädigt')),note text not null default '',created_at timestamptz not null default now(),
 foreign key(collection_id,owner) references public.collections(id,owner)
);
create index sealed_items_owner on public.sealed_items(owner);
alter table public.sealed_items enable row level security;
revoke all on public.sealed_items from anon,authenticated;
grant all on public.sealed_items to service_role;
create or replace function public.portal_collection_kind() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.collections where id=new.collection_id and owner=new.owner and kind=case when TG_TABLE_NAME='cards' then 'cards' else 'sealed' end) then raise exception 'Collection type mismatch'; end if;
 return new;
end $$;
revoke all on function public.portal_collection_kind() from public,anon,authenticated;
create trigger cards_collection_kind before insert or update of collection_id,owner on public.cards for each row execute function public.portal_collection_kind();
create trigger sealed_collection_kind before insert or update of collection_id,owner on public.sealed_items for each row execute function public.portal_collection_kind();

alter table public.price_submissions add column needs_review boolean not null default false;
create or replace function public.portal_review_price(submission_id text,reviewer_id uuid,decision text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s public.price_submissions; q jsonb; shared jsonb;
begin
 if not exists(select 1 from public.portal_accounts where user_id=reviewer_id and role='admin' and active) then raise exception 'Admin required'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into s from public.price_submissions where id=submission_id for update;
 if not found then raise exception 'Submission missing'; end if;
 if s.status<>'pending' then return jsonb_build_object('alreadyReviewed',true); end if;
 update public.price_submissions set status=decision,needs_review=false,reviewed_by=reviewer_id,reviewed_at=now() where id=s.id;
 if decision='approved' then
 q=jsonb_build_object('price',s.price_cents/100.0,'language',s.language,'variant',s.variant,'condition','NM','scope','language','metric','asking-low','source','Cardmarket · manuell geprüft','manualApproved',true,'updated',s.observed_on,'fetchedAt',now(),'sourceUrl',s.source_url);
 insert into public.market_quotes(id,data,updated_at) values(s.card_id||'/'||s.language,jsonb_build_object('marketLanguage',s.language,'languagePriceStatus','available','languageMarketQuotes',jsonb_build_object(s.variant,q)),now())
 on conflict(id) do update set data=market_quotes.data || jsonb_build_object('marketLanguage',s.language,'languagePriceStatus','available','languageMarketQuotes',coalesce(market_quotes.data->'languageMarketQuotes','{}'::jsonb)||jsonb_build_object(s.variant,q)),updated_at=now()
 returning data into shared;
 update public.cards set data=((data::jsonb - 'personalMarketQuote') || shared)::text where card_id=s.card_id and language=s.language and variant=s.variant and condition='NM';
 else
 update public.cards set data=jsonb_set(data::jsonb,'{personalMarketQuote,status}','"rejected"'::jsonb)::text where owner=s.owner and data::jsonb->'personalMarketQuote'->>'submissionId'=s.id;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_review_price(text,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_review_price(text,uuid,text) to service_role;
