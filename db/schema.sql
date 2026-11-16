-- 댓글 서비스. thinkthink 와 같은 Supabase 프로젝트에 있지만 스키마로 갈라 둔다.
-- 함께 쓰는 것은 로그인 사용자(auth.users) 하나뿐이다.
-- REST 로 닿으려면 API 설정의 Exposed schemas 에 comments 를 넣어야 한다.

create schema if not exists comments;

create table if not exists comments.comments (
  id uuid primary key default gen_random_uuid(),
  page text not null check (length(page) between 1 and 500),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    '익명'
  ),
  avatar text default auth.jwt() -> 'user_metadata' ->> 'avatar_url',
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists comments_page_created on comments.comments (page, created_at);

alter table comments.comments enable row level security;

-- 읽기는 누구나
drop policy if exists "read all" on comments.comments;
create policy "read all" on comments.comments for select
  to anon, authenticated using (true);

-- 쓰기는 로그인한 본인 이름으로만
drop policy if exists "write own" on comments.comments;
create policy "write own" on comments.comments for insert
  to authenticated with check (auth.uid() = user_id);

-- 지우기는 본인, 또는 사이트 주인(스팸 정리)
drop policy if exists "delete own or owner" on comments.comments;
create policy "delete own or owner" on comments.comments for delete
  to authenticated using (
    auth.uid() = user_id
    or auth.jwt() ->> 'email' = 'juniq.lim@gmail.com'
  );

grant usage on schema comments to anon, authenticated;
grant select on comments.comments to anon, authenticated;
grant insert (page, body) on comments.comments to authenticated;
grant delete on comments.comments to authenticated;
