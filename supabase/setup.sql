-- Run once in your Supabase SQL editor. All materials are private to their owner.
create table if not exists public.lessons (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
create policy "Read own lessons" on public.lessons for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own lessons" on public.lessons for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own lessons" on public.lessons for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own lessons" on public.lessons for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('study-files', 'study-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
create policy "Read own study files" on storage.objects for select to authenticated using (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own study files" on storage.objects for insert to authenticated with check (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Update own study files" on storage.objects for update to authenticated using (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own study files" on storage.objects for delete to authenticated using (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
