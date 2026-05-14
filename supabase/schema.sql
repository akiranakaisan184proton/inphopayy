-- InphoPay - Schema do Supabase
-- Rode tudo isto no SQL Editor do seu projeto Supabase (uma vez).

create table if not exists public.users (
  id bigserial primary key,
  username text unique,
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'client',
  approval_status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id bigserial primary key,
  user_id bigint unique not null references public.users(id) on delete cascade,
  balance_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.pix_transactions (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  amount_cents bigint not null,
  status text not null default 'pending',
  tribopay_transaction_id text,
  tribopay_offer_hash text,
  tribopay_product_hash text,
  pix_qr_code text,
  customer_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checkout_links (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  token text unique not null,
  title text not null,
  amount_cents bigint not null,
  status text not null default 'ready',
  tribopay_transaction_id text,
  pix_qr_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  key_hash text unique not null,
  key_hint text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  amount_cents bigint not null,
  pix_key text not null,
  status text not null default 'processing',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pix_user on public.pix_transactions(user_id);
create index if not exists idx_checkout_user on public.checkout_links(user_id);
create index if not exists idx_apikeys_user on public.api_keys(user_id);
create index if not exists idx_withdrawals_user on public.withdrawal_requests(user_id);

-- O backend acessa via service_role, entao deixamos RLS desligado nessas tabelas internas.
alter table public.users disable row level security;
alter table public.wallets disable row level security;
alter table public.pix_transactions disable row level security;
alter table public.checkout_links disable row level security;
alter table public.api_keys disable row level security;
alter table public.withdrawal_requests disable row level security;

-- Usuario admin padrao: usuario=inphoadmin, senha=inpho123
-- (hash bcrypt para 'inpho123' com cost 10)
insert into public.users (username, name, email, password_hash, role, approval_status)
values (
  'inphoadmin',
  'Inpho Admin',
  'inphoadmin@inphopay.local',
  '$2b$10$yWquC39As9p7EyMXQ1FvBOfFIA/9BYdHGJpY1aeGP5krIR1meWWIy',
  'client',
  'approved'
)
on conflict (username) do nothing;

insert into public.wallets (user_id, balance_cents)
select id, 0 from public.users where username = 'inphoadmin'
on conflict (user_id) do nothing;
