alter table public.orders
add column if not exists payment_reference text;

alter table public.orders
add column if not exists payment_status text
default 'pending';

alter table public.orders
add column if not exists paid_at timestamptz;

alter table public.orders
add column if not exists payment_method text;

alter table public.orders
add column if not exists paystack_transaction_id bigint;

create index if not exists orders_payment_reference_idx
on public.orders(payment_reference);