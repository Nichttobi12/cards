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
