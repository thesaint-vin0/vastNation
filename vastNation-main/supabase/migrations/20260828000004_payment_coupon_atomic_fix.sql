-- Vast Nation: atomic Paystack finalization + reliable coupon usage counts.
-- Run this migration before testing payments.

alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_user_limit integer;
alter table public.coupons add column if not exists usage_count integer not null default 0;

-- Rebuild usage_count from successful paid orders so existing coupons start accurate.
update public.coupons c
set usage_count = coalesce((
  select count(*)::integer
  from public.orders o
  where upper(trim(o.coupon_code)) = upper(trim(c.code))
    and o.payment_status = 'paid'
), 0);

-- Atomic finalization. This function is called ONLY by the Paystack webhook
-- after Paystack has verified the transaction as successful.
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
  v_coupon public.coupons%rowtype;
  v_already boolean := false;
  v_paid_at timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if abs(coalesce(v_order.total, 0) - coalesce(p_amount, 0)) > 0.01 then
    raise exception 'Payment amount does not match order total';
  end if;

  if v_order.payment_status = 'paid' then
    v_already := true;
  else
    update public.orders
    set payment_status = 'paid',
        payment_reference = p_reference,
        payment_ref = p_reference,
        paid_at = v_paid_at,
        payment_method = coalesce(p_channel, 'paystack'),
        paystack_transaction_id = p_transaction_id
    where id = p_order_id;
  end if;

  -- A successful payment must have exactly one successful payment-history row.
  insert into public.payments (
    order_id, user_id, reference, amount, status, channel
  ) values (
    p_order_id, v_order.user_id, p_reference, p_amount, 'success', coalesce(p_channel, 'paystack')
  )
  on conflict (reference) do update set
    order_id = excluded.order_id,
    user_id = excluded.user_id,
    amount = excluded.amount,
    status = 'success',
    channel = excluded.channel;

  -- Count a coupon only once per paid order. The locked order row makes this safe
  -- against duplicate Paystack webhook deliveries.
  if not v_already and v_order.coupon_code is not null and trim(v_order.coupon_code) <> '' then
    select * into v_coupon
    from public.coupons
    where upper(code) = upper(trim(v_order.coupon_code))
    for update;

    if found then
      update public.coupons
      set usage_count = coalesce(usage_count, 0) + 1
      where id = v_coupon.id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_paid', v_already,
    'order_id', p_order_id,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.finalize_paystack_payment(uuid, text, numeric, text, bigint) from public;
grant execute on function public.finalize_paystack_payment(uuid, text, numeric, text, bigint) to service_role;

-- Realtime must include coupons so usage_count changes reach the admin page.
do $$ begin
  alter publication supabase_realtime add table public.coupons;
exception when duplicate_object then null; end $$;
alter table public.coupons replica identity full;

notify pgrst, 'reload schema';
