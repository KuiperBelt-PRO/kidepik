-- Aventura: purposes en cola + forzar discovery inmediato (SPEC_AI_OPENROUTER_GATEWAY §4.5, ago 2026).
-- No sembrar ids concretos: FreeModelQueueSync rellena desde OpenRouter al arrancar.

insert into public.ai_runtime_state (key, value, updated_at)
values ('free_model_discovery_last_run', '0', now())
on conflict (key) do update set
  value = '0',
  updated_at = now();

-- Deshabilitar modelos semilla que OpenRouter ya no expone (404 recurrente).
update public.ai_purpose_model_queues
set enabled = false,
    notes = 'disabled: upstream 404 (auto-hygiene)',
    updated_at = now()
where model_id in (
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-30b-a3b:free'
)
  and enabled = true;
