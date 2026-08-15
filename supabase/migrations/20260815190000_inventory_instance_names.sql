-- Instancia nombrada por el agente al otorgar (SPEC_APP_ITEM_CATALOG §5b)

alter table public.child_inventory_items
  drop constraint if exists child_inventory_items_child_id_world_theme_item_def_id_key;

alter table public.child_inventory_items
  add column if not exists instance_name text;

alter table public.child_inventory_items
  add column if not exists instance_description text;
