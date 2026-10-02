alter table public.cards add column if not exists photo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-photos','card-photos',false,1048576,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/jpeg'];
-- No public or authenticated-user storage policies. All access is mediated
-- by the portal's verified two-account API with owner checks and expiring URLs.
