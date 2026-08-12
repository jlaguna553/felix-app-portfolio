-- AI agent: conversations and messages storage
create table public.ai_conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade not null,
  title       text        not null default 'Nueva conversación',
  provider    text        not null default 'claude',
  model       text        not null default 'claude-sonnet-4-6',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ai_messages (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        references public.ai_conversations(id) on delete cascade not null,
  role             text        not null check (role in ('user', 'assistant')),
  content          text        not null,
  tool_calls       jsonb,
  created_at       timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;

create policy "Users see own conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id);

create policy "Users see own conversation messages"
  on public.ai_messages for all
  using (
    conversation_id in (
      select id from public.ai_conversations where user_id = auth.uid()
    )
  );

-- AI config defaults in the settings table
insert into public.settings (key, value) values
  ('ai_provider',   'claude'),
  ('ai_model',      'claude-sonnet-4-6'),
  ('ai_ollama_url', 'http://localhost:11434'),
  ('ai_claude_key', ''),
  ('ai_gemini_key', '')
on conflict (key) do nothing;
