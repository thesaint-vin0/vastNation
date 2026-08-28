-- Vast Nation: harden checkout, payment initialization and coupon usage.
-- This migration is intentionally defensive for databases that already contain
-- older versions of these tables/functions.

-- Required order/payment columns.
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists paystack_transaction_id bigint;
alter table public.orders add column if not exists coupon_code text;

-- Required coupon counters.
alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_user_limit integer;
alter table public.coupons add column if not exists usage_count integer not null default 0;

-- Ensure every existing paid order is reflected in the coupon count.
update public.coupons c
set usage_count = coalesce((
  select count(*)::integer
  from public.orders o
  where o.payment_status = 'paid'
    and o.coupon_code is not null
    and upper(trim(o.coupon_code)) = upper(trim(c.code))
), 0);

-- Rebuild the canonical atomic finalizer. It is safe against duplicate webhooks
-- because the order row is locked and coupon increment occurs only on the first
-- transition to paid.
create or replace function public.finalize_paystack_payment(
  p_order_id uuid,
  p_reference text,
  p_amount numeric,
  p_channel text default 'paystack',
  p_transaction_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_already_paid boolean := false;
  v_coupon public.coupons%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  if abs(coalesce(v_order.total,0) - coalesce(p_amount,0)) > 0.01 then
    raise exception 'Payment amount does not match order total';
  end if;

  if v_order.payment_status = 'paid' then
    v_already_paid := true;
  else
    update public.orders
    set payment_status = 'paid',
        payment_reference = p_reference,
        payment_ref = p_reference,
        paid_at = coalesce(paid_at, now()),
        payment_method = coalesce(p_channel, 'paystack'),
        paystack_transaction_id = p_transaction_id
    where id = p_order_id;
  end if;

  -- payments.reference is unique, so duplicate webhook deliveries are harmless.
  insert into public.payments (order_id, user_id, reference, amount, status, channel)
  values (p_order_id, v_order.user_id, p_reference, p_amount, 'success', coalesce(p_channel,'paystack'))
  on conflict (reference) do update set
    order_id = excluded.order_id,
    user_id = excluded.user_id,
    amount = excluded.amount,
    status = 'success',
    channel = excluded.channel;

  if not v_already_paid and nullif(trim(v_order.coupon_code), '') is not null then
    select * into v_coupon
    from public.coupons
    where upper(trim(code)) = upper(trim(v_order.coupon_code))
    for update;

    if found then
      update public.coupons
      set usage_count = coalesce(usage_count,0) + 1
      where id = v_coupon.id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_paid', v_already_paid,
    'order_id', p_order_id,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.finalize_paystack_payment(uuid,text,numeric,text,bigint) from public;
grant execute on function public.finalize_paystack_payment(uuid,text,numeric,text,bigint) to service_role;

-- Secure, atomic order creation. This avoids the fragile INSERT ... SELECT flow
-- and guarantees that an order cannot exist without its line items.
create or replace function public.create_pending_order(
  p_order jsonb,
  p_items jsonb
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_user uuid := auth.uid();
  v_user_id uuid;
  v_order_id uuid;
  v_item_product uuid;
  v_item_name text;
  v_item_image text;
  v_item_size text;
  v_item_color text;
  v_item_price numeric;
  v_item_quantity integer;
begin
  if v_user is null then raise exception 'Unauthorized'; end if;

  v_user_id := coalesce(nullif(p_order->>'user_id','')::uuid, v_user);
  if v_user_id <> v_user then raise exception 'You can only create orders for your own account'; end if;

  insert into public.orders (
    user_id, order_number, status, subtotal, discount, shipping, total,
    coupon_code, shipping_address, delivery_method, payment_ref, payment_status
  ) values (
    v_user,
    p_order->>'order_number',
    coalesce(p_order->>'status','pending'),
    coalesce((p_order->>'subtotal')::numeric,0),
    coalesce((p_order->>'discount')::numeric,0),
    coalesce((p_order->>'shipping')::numeric,0),
    coalesce((p_order->>'total')::numeric,0),
    nullif(p_order->>'coupon_code',''),
    case when p_order ? 'shipping_address' then p_order->'shipping_address' else null end,
    coalesce(p_order->>'delivery_method','standard'),
    null,
    'pending'
  ) returning * into v_order;

  v_order_id := v_order.id;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_product := nullif(v_item->>'product_id','')::uuid;
    v_item_name := coalesce(v_item->>'name','');
    v_item_image := nullif(v_item->>'image_url','');
    v_item_size := nullif(v_item->>'size','');
    v_item_color := nullif(v_item->>'color','');
    v_item_price := coalesce((v_item->>'price')::numeric,0);
    v_item_quantity := coalesce((v_item->>'quantity')::integer,0);

    if v_item_name = '' or v_item_price <= 0 or v_item_quantity <= 0 then
      raise exception 'Invalid order item';
    end if;

    insert into public.order_items(order_id, product_id, name, image_url, size, color, price, quantity)
    values (v_order_id, v_item_product, v_item_name, v_item_image, v_item_size, v_item_color, v_item_price, v_item_quantity);
  end loop;

  return v_order;
end;
$$;

revoke all on function public.create_pending_order(jsonb,jsonb) from public;
grant execute on function public.create_pending_order(jsonb,jsonb) to authenticated;

-- Ensure realtime can deliver coupon usage changes.
do $$ begin
  alter publication supabase_realtime add table public.coupons;
exception when duplicate_object then null; end $$;
alter table public.coupons replica identity full;

notify pgrst, 'reload schema';
