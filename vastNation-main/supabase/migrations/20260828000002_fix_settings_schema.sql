-- Vast Nation: repair/upgrade settings schema safely on existing databases.
-- This migration is intentionally idempotent so it also fixes databases where
-- an earlier settings migration partially ran or store_settings already existed.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists theme text not null default 'dark';
alter table public.user_settings add column if not exists order_updates boolean not null default true;
alter table public.user_settings add column if not exists payment_updates boolean not null default true;
alter table public.user_settings add column if not exists shipping_updates boolean not null default true;
alter table public.user_settings add column if not exists product_alerts boolean not null default true;
alter table public.user_settings add column if not exists newsletter boolean not null default true;
alter table public.user_settings add column if not exists promotions boolean not null default true;
alter table public.user_settings add column if not exists updated_at timestamptz not null default now();

alter table public.user_settings drop constraint if exists user_settings_theme_check;
alter table public.user_settings add constraint user_settings_theme_check
  check (theme in ('light', 'dark', 'system'));

alter table public.user_settings enable row level security;
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_settings_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_user_settings_updated_at();

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

alter table public.store_settings add column if not exists store_name text not null default 'Vast Nation';
alter table public.store_settings add column if not exists store_email text not null default '';
alter table public.store_settings add column if not exists store_phone text not null default '';
alter table public.store_settings add column if not exists store_address text not null default '';
alter table public.store_settings add column if not exists currency text not null default 'NGN';
alter table public.store_settings add column if not exists free_shipping_threshold numeric(12,2) not null default 100000;
alter table public.store_settings add column if not exists standard_shipping_fee numeric(12,2) not null default 2500;
alter table public.store_settings add column if not exists express_shipping_fee numeric(12,2) not null default 5000;
alter table public.store_settings add column if not exists tax_rate numeric(6,3) not null default 0;
alter table public.store_settings add column if not exists maintenance_mode boolean not null default false;
alter table public.store_settings add column if not exists notify_new_order boolean not null default true;
alter table public.store_settings add column if not exists notify_payment boolean not null default true;
alter table public.store_settings add column if not exists notify_low_stock boolean not null default true;
alter table public.store_settings add column if not exists notify_new_review boolean not null default true;
alter table public.store_settings add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.store_settings add column if not exists updated_at timestamptz not null default now();

alter table public.store_settings enable row level security;
drop policy if exists "store_settings_public_read" on public.store_settings;
create policy "store_settings_public_read" on public.store_settings
  for select to anon, authenticated using (true);
drop policy if exists "store_settings_admin_insert" on public.store_settings;
create policy "store_settings_admin_insert" on public.store_settings
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "store_settings_admin_update" on public.store_settings;
create policy "store_settings_admin_update" on public.store_settings
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.store_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.store_settings);

-- Keep coupon limits available even if the earlier coupon migration was skipped.
alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_user_limit integer;
alter table public.coupons add column if not exists usage_count integer not null default 0;

alter table public.coupons drop constraint if exists coupons_usage_limit_check;
alter table public.coupons add constraint coupons_usage_limit_check
  check (usage_limit is null or usage_limit > 0);
alter table public.coupons drop constraint if exists coupons_per_user_limit_check;
alter table public.coupons add constraint coupons_per_user_limit_check
  check (per_user_limit is null or per_user_limit > 0);
alter table public.coupons drop constraint if exists coupons_usage_count_check;
alter table public.coupons add constraint coupons_usage_count_check
  check (usage_count >= 0);

-- Force PostgREST to refresh its schema cache immediately after the migration.
notify pgrst, 'reload schema';
