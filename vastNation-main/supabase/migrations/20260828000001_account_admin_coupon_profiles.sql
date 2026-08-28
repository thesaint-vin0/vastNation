-- Vast Nation: account security, profile uploads, admin creation support and coupon editing/limits.

alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_user_limit integer;
alter table public.coupons add column if not exists usage_count integer not null default 0;

alter table public.coupons drop constraint if exists coupons_usage_limit_check;
alter table public.coupons add constraint coupons_usage_limit_check check (usage_limit is null or usage_limit > 0);
alter table public.coupons drop constraint if exists coupons_per_user_limit_check;
alter table public.coupons add constraint coupons_per_user_limit_check check (per_user_limit is null or per_user_limit > 0);
alter table public.coupons drop constraint if exists coupons_usage_count_check;
alter table public.coupons add constraint coupons_usage_count_check check (usage_count >= 0);

-- Allow authenticated users to upload only their own avatar path; admins may upload any profile avatar.
drop policy if exists "Users can upload own profile images" on storage.objects;
create policy "Users can upload own profile images" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (name like 'profiles/' || auth.uid()::text || '/%'));

drop policy if exists "Users can update own profile images" on storage.objects;
create policy "Users can update own profile images" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (name like 'profiles/' || auth.uid()::text || '/%'))
with check (bucket_id = 'product-images' and (name like 'profiles/' || auth.uid()::text || '/%'));

drop policy if exists "Users can delete own profile images" on storage.objects;
create policy "Users can delete own profile images" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (name like 'profiles/' || auth.uid()::text || '/%'));

-- Keep coupon usage counts synchronized from the existing order data where possible.
do $$
begin
  if to_regclass('public.orders') is not null then
    update public.coupons c
    set usage_count = x.used_count
    from (
      select upper(coupon_code) code, count(*)::integer used_count
      from public.orders
      where coupon_code is not null and payment_status = 'paid'
      group by upper(coupon_code)
    ) x
    where upper(c.code) = x.code;
  end if;
end $$;

-- Public users can validate coupons but only admins can mutate them (existing policies remain in force).
