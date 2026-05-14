-- Rode no SQL Editor do Supabase se o projeto ja existia antes desta feature.

alter table public.users add column if not exists approval_status text not null default 'approved';
alter table public.users add column if not exists rejection_reason text;

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

create index if not exists idx_withdrawals_user on public.withdrawal_requests(user_id);

alter table public.withdrawal_requests disable row level security;
