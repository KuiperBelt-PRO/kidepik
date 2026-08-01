-- Colas de modelos OpenRouter por purpose (editable sin redeploy).
-- SPEC_AI_OPENROUTER_GATEWAY § purpose queues / A1 placement agent-only.

create table if not exists public.ai_purpose_model_queues (
  purpose text not null,
  model_id text not null,
  position int not null check (position >= 1),
  enabled boolean not null default true,
  notes text null,
  updated_at timestamptz not null default now(),
  primary key (purpose, model_id)
);

create index if not exists ai_purpose_model_queues_purpose_pos
  on public.ai_purpose_model_queues (purpose, position)
  where enabled;

-- Semilla inicial (free). Ajustar con UPDATE/INSERT sin desplegar código.
insert into public.ai_purpose_model_queues (purpose, model_id, position, notes) values
  ('placement_exam_composer', 'google/gemma-3-27b-it:free', 1, 'seed placement'),
  ('placement_exam_composer', 'meta-llama/llama-3.3-70b-instruct:free', 2, 'seed placement'),
  ('placement_exam_composer', 'qwen/qwen3-30b-a3b:free', 3, 'seed placement'),
  ('placement_exam_batch_writer', 'google/gemma-3-27b-it:free', 1, 'seed placement rewrite'),
  ('placement_exam_batch_writer', 'meta-llama/llama-3.3-70b-instruct:free', 2, 'seed placement rewrite'),
  ('placement_item_writer', 'google/gemma-3-27b-it:free', 1, 'seed placement item'),
  ('dialogue', 'meta-llama/llama-3.3-70b-instruct:free', 1, 'seed dialogue'),
  ('dialogue', 'google/gemma-3-27b-it:free', 2, 'seed dialogue'),
  ('journey_summarizer', 'meta-llama/llama-3.3-70b-instruct:free', 1, 'seed journey')
on conflict (purpose, model_id) do nothing;
