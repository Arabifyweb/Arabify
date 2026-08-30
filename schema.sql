-- ============================================================================
-- Arabify — Supabase schema
-- طريقة التشغيل: افتح مشروعك على supabase.com → SQL Editor → الصق هذا الملف
-- كاملاً → Run. ثم فعّل Google كمزوّد في Authentication → Providers.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1) profiles — يمتد من auth.users المُدار من Supabase Auth
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  google_sub text unique,               -- Google user id عند التسجيل عبر Google
  followers_count int not null default 0,
  following_count int not null default 0,
  projects_count int not null default 0,
  created_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- إنشاء الملف الشخصي تلقائيًا عند أول تسجيل دخول (Google أو Email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_username text;
  final_username text;
  n int := 0;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'user'
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  if base_username = '' then base_username := 'user'; end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1;
    final_username := base_username || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, google_sub)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', base_username),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'sub'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2) projects
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'مشروع بدون اسم',
  description text,
  category text,
  tags text[] default '{}',
  visibility text not null default 'private' check (visibility in ('public','private')),
  status text not null default 'draft' check (status in ('draft','published')),
  design_json jsonb not null,           -- حالة المحرر الكاملة (الطبقات، النصوص، التأثيرات...)
  image_url text,                       -- صورة المعاينة المُصدَّرة (PNG) في Supabase Storage
  likes_count int not null default 0,
  saves_count int not null default 0,
  views_count int not null default 0,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id);
create index projects_public_idx on public.projects (visibility, status, created_at desc) where visibility = 'public' and status = 'published';
create index projects_category_idx on public.projects (category);
create index projects_tags_idx on public.projects using gin (tags);
-- بحث نصي عربي بسيط على العنوان/الوصف/الوسوم
create index projects_search_idx on public.projects using gin (
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || array_to_string(tags,' '))
);

-- ----------------------------------------------------------------------------
-- 3) likes / saves / collections
-- ----------------------------------------------------------------------------
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.collections (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id, collection_id)
);

-- ----------------------------------------------------------------------------
-- 4) follows
-- ----------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ----------------------------------------------------------------------------
-- 5) comments
-- ----------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index comments_project_idx on public.comments (project_id, created_at);

-- ----------------------------------------------------------------------------
-- 6) views (مسجلة بحد أدنى بيانات، لمنع تضخيم العداد عبر refresh)
-- ----------------------------------------------------------------------------
create table public.project_views (
  project_id uuid not null references public.projects(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewer_fingerprint text,              -- لزوار غير مسجلين (hash من IP+UA يُحسب في الواجهة/edge function)
  viewed_at timestamptz not null default now()
);
create index project_views_dedupe_idx on public.project_views (project_id, coalesce(viewer_id::text, viewer_fingerprint), (date_trunc('hour', viewed_at at time zone 'utc')));

-- ----------------------------------------------------------------------------
-- 7) notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like','follow','save','comment','trending','system')),
  project_id uuid references public.projects(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read, created_at desc);

-- ----------------------------------------------------------------------------
-- 8) reports
-- ----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('project','comment','profile')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','copyright','inappropriate','harassment','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY — كل جدول محمي، لا وصول إلا وفق القواعد أدناه
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.likes enable row level security;
alter table public.collections enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.project_views enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- profiles: عامة للقراءة، تعديل الذات فقط
create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- projects: المنشور العام يقرأه الجميع، الخاص لصاحبه فقط
create policy "public projects are readable" on public.projects for select
  using (visibility = 'public' and status = 'published' or owner_id = auth.uid());
create policy "owner inserts own projects" on public.projects for insert
  with check (owner_id = auth.uid());
create policy "owner updates own projects" on public.projects for update
  using (owner_id = auth.uid());
create policy "owner deletes own projects" on public.projects for delete
  using (owner_id = auth.uid());

-- likes
create policy "likes are publicly readable" on public.likes for select using (true);
create policy "users like as themselves" on public.likes for insert with check (user_id = auth.uid());
create policy "users unlike their own like" on public.likes for delete using (user_id = auth.uid());

-- collections & saves: خاصة بصاحبها فقط
create policy "owner manages own collections" on public.collections for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner manages own saves" on public.saves for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows
create policy "follows are publicly readable" on public.follows for select using (true);
create policy "users follow as themselves" on public.follows for insert with check (follower_id = auth.uid());
create policy "users unfollow as themselves" on public.follows for delete using (follower_id = auth.uid());

-- comments: قراءة عامة على مشاريع منشورة، الكتابة لأي مستخدم مسجل، الحذف لصاحب التعليق فقط
create policy "comments on public projects are readable" on public.comments for select
  using (exists (select 1 from public.projects p where p.id = project_id and (p.visibility='public' or p.owner_id = auth.uid())));
create policy "authenticated users can comment" on public.comments for insert
  with check (author_id = auth.uid());
create policy "authors delete own comments" on public.comments for delete
  using (author_id = auth.uid());

-- project_views: إدراج فقط (لا قراءة/تعديل عام)
create policy "anyone can log a view" on public.project_views for insert with check (true);

-- notifications: كل مستخدم يرى إشعاراته فقط
create policy "users read own notifications" on public.notifications for select using (recipient_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (recipient_id = auth.uid());

-- reports: المُبلِّغ يرى بلاغاته فقط، الإدراج لأي مستخدم مسجل
create policy "reporters read own reports" on public.reports for select using (reporter_id = auth.uid());
create policy "authenticated users can report" on public.reports for insert with check (reporter_id = auth.uid());

-- ============================================================================
-- TRIGGERS للعدّادات (likes_count, saves_count, followers_count...)
-- ============================================================================
create or replace function public.bump_counter(tbl regclass, col text, id_col text, id_val uuid, delta int)
returns void language plpgsql security definer as $$
begin
  execute format('update %s set %I = greatest(0, %I + $1) where %I = $2', tbl, col, col, id_col)
  using delta, id_val;
end;
$$;

create or replace function public.on_like_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then perform public.bump_counter('public.projects','likes_count','id', new.project_id, 1);
  elsif tg_op = 'DELETE' then perform public.bump_counter('public.projects','likes_count','id', old.project_id, -1);
  end if;
  return null;
end; $$;
create trigger likes_counter after insert or delete on public.likes for each row execute procedure public.on_like_change();

create or replace function public.on_save_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then perform public.bump_counter('public.projects','saves_count','id', new.project_id, 1);
  elsif tg_op = 'DELETE' then perform public.bump_counter('public.projects','saves_count','id', old.project_id, -1);
  end if;
  return null;
end; $$;
create trigger saves_counter after insert or delete on public.saves for each row execute procedure public.on_save_change();

create or replace function public.on_follow_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    perform public.bump_counter('public.profiles','followers_count','id', new.followee_id, 1);
    perform public.bump_counter('public.profiles','following_count','id', new.follower_id, 1);
  elsif tg_op = 'DELETE' then
    perform public.bump_counter('public.profiles','followers_count','id', old.followee_id, -1);
    perform public.bump_counter('public.profiles','following_count','id', old.follower_id, -1);
  end if;
  return null;
end; $$;
create trigger follows_counter after insert or delete on public.follows for each row execute procedure public.on_follow_change();

create or replace function public.on_comment_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then perform public.bump_counter('public.projects','comments_count','id', new.project_id, 1);
  elsif tg_op = 'DELETE' then perform public.bump_counter('public.projects','comments_count','id', old.project_id, -1);
  end if;
  return null;
end; $$;
create trigger comments_counter after insert or delete on public.comments for each row execute procedure public.on_comment_change();

create or replace function public.on_project_published() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    perform public.bump_counter('public.profiles','projects_count','id', new.owner_id, 1);
  elsif old.status = 'published' and new.status <> 'published' then
    perform public.bump_counter('public.profiles','projects_count','id', new.owner_id, -1);
  end if;
  return null;
end; $$;
create trigger projects_publish_counter after update on public.projects for each row execute procedure public.on_project_published();

-- إشعار تلقائي عند إعجاب/متابعة/حفظ (بسيط — يمكن استبداله بـ Edge Function لاحقًا)
create or replace function public.notify_like() returns trigger language plpgsql security definer as $$
declare owner uuid;
begin
  select owner_id into owner from public.projects where id = new.project_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, project_id)
    values (owner, new.user_id, 'like', new.project_id);
  end if;
  return new;
end; $$;
create trigger notify_on_like after insert on public.likes for each row execute procedure public.notify_like();

create or replace function public.notify_follow() returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (recipient_id, actor_id, type) values (new.followee_id, new.follower_id, 'follow');
  return new;
end; $$;
create trigger notify_on_follow after insert on public.follows for each row execute procedure public.notify_follow();

-- ============================================================================
-- STORAGE — لصور المشاريع وصور الحسابات (نفّذ من واجهة Supabase Storage
-- أو أضف عبر SQL bucket policies إذا لزم؛ الأبسط: أنشئ Bucket باسم
-- "project-images" و "avatars" من لوحة Supabase واجعلهما Public للقراءة).
-- ============================================================================
