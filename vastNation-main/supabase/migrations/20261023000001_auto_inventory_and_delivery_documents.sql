-- Automatically deduct product inventory exactly once when Paystack confirms payment.
-- The order row lock and payment_status transition make duplicate webhooks idempotent.
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
  v_item record;
  v_updated integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if abs(coalesce(v_order.total,0) - coalesce(p_amount,0)) > 0.01 then
    raise exception 'Payment amount does not match order total';
  end if;

  if v_order.payment_status = 'paid' then
    v_already_paid := true;
  else
    -- Decrement stock within this transaction. A shortage aborts the entire finalization.
    for v_item in
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
      order by oi.product_id
    loop
      update public.products
      set stock = stock - v_item.quantity
      where id = v_item.product_id and stock >= v_item.quantity;
      get diagnostics v_updated = row_count;
      if v_updated = 0 then
        raise exception 'Insufficient stock for product % on order %', v_item.product_id, p_order_id;
      end if;
    end loop;

    update public.orders
    set payment_status = 'paid',
        payment_reference = p_reference,
        payment_ref = p_reference,
        paid_at = coalesce(paid_at, now()),
        payment_method = coalesce(p_channel, 'paystack'),
        paystack_transaction_id = p_transaction_id
    where id = p_order_id;
  end if;

  insert into public.payments (order_id, user_id, reference, amount, status, channel)
  values (p_order_id, v_order.user_id, p_reference, p_amount, 'success', coalesce(p_channel,'paystack'))
  on conflict (reference) do update set
    order_id = excluded.order_id, user_id = excluded.user_id, amount = excluded.amount,
    status = 'success', channel = excluded.channel;

  if not v_already_paid and nullif(trim(v_order.coupon_code), '') is not null then
    select * into v_coupon from public.coupons
    where upper(trim(code)) = upper(trim(v_order.coupon_code)) for update;
    if found then
      update public.coupons set usage_count = coalesce(usage_count,0) + 1 where id = v_coupon.id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'already_paid', v_already_paid, 'order_id', p_order_id, 'reference', p_reference);
end;
$$;

revoke all on function public.finalize_paystack_payment(uuid,text,numeric,text,bigint) from public;
grant execute on function public.finalize_paystack_payment(uuid,text,numeric,text,bigint) to service_role;
notify pgrst, 'reload schema';
