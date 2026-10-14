-- Run in Supabase → SQL Editor
create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text,department text,role text not null default 'user' check(role in('user','admin')),created_at timestamptz default now());
create table public.tickets(id uuid primary key default gen_random_uuid(),ticket_no bigint generated always as identity,user_id uuid not null references auth.users on delete cascade default auth.uid(),requester_name text,requester_email text,category text,priority text default 'Medium',subject text not null,description text not null,related_item text,phone text,status text not null default 'Open' check(status in('Open','In Progress','Resolved','Closed')),created_at timestamptz default now());
create table public.updates(id uuid primary key default gen_random_uuid(),title text not null,body text not null,created_by uuid references auth.users,created_at timestamptz default now());
create function public.is_admin() returns boolean language sql security definer stable set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='admin')$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)));return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
alter table profiles enable row level security;alter table tickets enable row level security;alter table updates enable row level security;
create policy "own profile read" on profiles for select using(id=auth.uid() or is_admin());
create policy "own profile update" on profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=(select role from profiles where id=auth.uid()));
create policy "own tickets read" on tickets for select using(user_id=auth.uid() or is_admin());
create policy "own tickets insert" on tickets for insert with check(user_id=auth.uid());
create policy "admin tickets update" on tickets for update using(is_admin());
create policy "updates read" on updates for select using(auth.role()='authenticated');
create policy "admin updates write" on updates for insert with check(is_admin());
-- Make yourself admin after signing up:  update profiles set role='admin' where id=(select id from auth.users where email='you@danfoss.com');
