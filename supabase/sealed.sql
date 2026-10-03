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
