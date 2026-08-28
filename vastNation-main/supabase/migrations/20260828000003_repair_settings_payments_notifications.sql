-- Robust repair for existing Vast Nation installations.
-- Fixes stale user_settings foreign keys, adds atomic user-settings saving,
-- hardens Paystack/payment notifications, and makes realtime reliable.

-- Ensure user_settings references auth.users, not a stale/incorrect target.
do $$
declare r record;
begin
  for r in select constraint_name from information_schema.table_constraints
    where table_schema='public' and table_name='user_settings' and constraint_type='FOREIGN KEY'
  loop
    execute format('alter table public.user_settings drop constraint if exists %I', r.constraint_name);
  end loop;
end $$;

-- Remove orphan settings rows before recreating the correct FK.
delete from public.user_settings us
where not exists (select 1 from auth.users u where u.id = us.user_id);

alter table public.user_settings
  add constraint user_settings_user_id_fkey foreign key (user_id)
  references auth.users(id) on delete cascade;

-- Atomic, authenticated settings save. This avoids frontend race conditions.
create or replace function public.save_user_settings(
  p_theme text default null,
  p_order_updates boolean default null,
  p_payment_updates boolean default null,
  p_shipping_updates boolean default null,
  p_product_alerts boolean default null,
  p_newsletter boolean default null,
  p_promotions boolean default null
) returns public.user_settings
language plpgsql security definer set search_path = public
as $$
declare result public.user_settings;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  insert into public.user_settings(user_id, theme, order_updates, payment_updates, shipping_updates, product_alerts, newsletter, promotions)
  values (
    auth.uid(),
    coalesce(p_theme, 'dark'),
    coalesce(p_order_updates, true), coalesce(p_payment_updates, true), coalesce(p_shipping_updates, true),
    coalesce(p_product_alerts, true), coalesce(p_newsletter, true), coalesce(p_promotions, true)
  )
  on conflict (user_id) do update set
    theme = coalesce(excluded.theme, public.user_settings.theme),
    order_updates = coalesce(excluded.order_updates, public.user_settings.order_updates),
    payment_updates = coalesce(excluded.payment_updates, public.user_settings.payment_updates),
    shipping_updates = coalesce(excluded.shipping_updates, public.user_settings.shipping_updates),
    product_alerts = coalesce(excluded.product_alerts, public.user_settings.product_alerts),
    newsletter = coalesce(excluded.newsletter, public.user_settings.newsletter),
    promotions = coalesce(excluded.promotions, public.user_settings.promotions),
    updated_at = now()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.save_user_settings(text, boolean, boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.save_user_settings(text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Make sure store settings has exactly one canonical row and all columns exist.
alter table public.store_settings add column if not exists free_shipping_threshold numeric(12,2) not null default 100000;
alter table public.store_settings add column if not exists standard_shipping_fee numeric(12,2) not null default 2500;
alter table public.store_settings add column if not exists express_shipping_fee numeric(12,2) not null default 5000;
alter table public.store_settings add column if not exists tax_rate numeric(6,3) not null default 0;
insert into public.store_settings (id) select gen_random_uuid() where not exists (select 1 from public.store_settings);

-- Ensure realtime publication membership.
do $$ begin
  alter publication supabase_realtime add table public.admin_notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.coupons;
exception when duplicate_object then null; end $$;
alter table public.admin_notifications replica identity full;
alter table public.coupons replica identity full;

-- Notification triggers are recreated so old broken triggers cannot suppress events.
create or replace function public.notify_vast_nation_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.store_settings%rowtype; customer_name text;
begin
  select * into s from public.store_settings order by updated_at desc limit 1;
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'A customer') into customer_name
  from public.profiles p where p.id = new.user_id;
  if tg_op = 'INSERT' and coalesce(s.notify_new_order, true) then
    perform public.create_admin_notification('new_order','New order received', customer_name || ' placed order ' || coalesce(new.order_number, new.id::text) || ' for ₦' || to_char(coalesce(new.total,0),'FM999,999,990.00'), new.id);
  end if;
  if tg_op = 'UPDATE' and old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' and coalesce(s.notify_payment, true) then
    perform public.create_admin_notification('payment','Payment confirmed', customer_name || ' paid ₦' || to_char(coalesce(new.total,0),'FM999,999,990.00') || ' for order ' || coalesce(new.order_number,new.id::text), new.id);
  end if;
  return new;
end; $$;
drop trigger if exists orders_admin_notification on public.orders;
create trigger orders_admin_notification after insert or update of payment_status on public.orders for each row execute function public.notify_vast_nation_order();

create or replace function public.notify_vast_nation_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.store_settings%rowtype; customer_name text; product_name text;
begin
  select * into s from public.store_settings order by updated_at desc limit 1;
  if coalesce(s.notify_new_review,true) then
    select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'A customer') into customer_name from public.profiles p where p.id=new.user_id;
    select name into product_name from public.products where id=new.product_id;
    perform public.create_admin_notification('review','New product review',customer_name || ' reviewed ' || coalesce(product_name,'a product') || ' (' || new.rating || '/5).',new.id);
  end if;
  return new;
end; $$;
drop trigger if exists reviews_admin_notification on public.reviews;
create trigger reviews_admin_notification after insert on public.reviews for each row execute function public.notify_vast_nation_review();

-- Give admins a way to see current notifications even when an event happened before login.
-- RLS remains admin-only.
notify pgrst, 'reload schema';

-- Also notify when a payment-history row is successfully recorded, as a fallback
-- for installations whose webhook updates payments before the order update is visible.
create or replace function public.notify_vast_nation_payment_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; s public.store_settings%rowtype; customer_name text;
begin
  if new.status = 'success' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select * into s from public.store_settings order by updated_at desc limit 1;
    if coalesce(s.notify_payment,true) and not exists (select 1 from public.admin_notifications n where n.type='payment' and n.entity_id=new.order_id and n.created_at > now() - interval '30 seconds') then
      select * into o from public.orders where id=new.order_id;
      select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.email),''),'A customer') into customer_name from public.profiles p where p.id=new.user_id;
      perform public.create_admin_notification('payment','Payment received',customer_name || ' completed payment of ₦' || to_char(coalesce(new.amount,0),'FM999,999,990.00') || ' (' || coalesce(new.reference,'no reference') || ').',new.order_id);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists payments_admin_notification on public.payments;
create trigger payments_admin_notification after insert or update of status on public.payments for each row execute function public.notify_vast_nation_payment_row();
