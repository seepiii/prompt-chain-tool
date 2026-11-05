-- Week 8: Prompt Chain Tool.
-- Builds on prompt_chains / prompt_chain_steps / llm_models from the Week 7 admin migration.
-- Additive only: older deployments of the main app and admin area never read these new objects.

-- ---------- Every time a chain is run, and what each step produced ----------
create table if not exists public.prompt_chain_runs (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains(id) on delete cascade,
  input_text text,
  input_image_url text,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  output_text text,
  output_image_url text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists prompt_chain_runs_chain_idx on public.prompt_chain_runs (chain_id, created_at desc);

-- A snapshot of each step as it ran, so editing a step later doesn't rewrite history.
create table if not exists public.prompt_chain_run_steps (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.prompt_chain_runs(id) on delete cascade,
  step_order int not null,
  step_name text not null,
  model_key text,
  instructions text not null,
  input text,
  output_text text,
  output_image_url text,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists prompt_chain_run_steps_run_idx on public.prompt_chain_run_steps (run_id, step_order);

do $$
declare t text;
begin
  foreach t in array array['prompt_chain_runs', 'prompt_chain_run_steps']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "superadmins manage" on public.%I', t);
    execute format('create policy "superadmins manage" on public.%I for all to authenticated
      using (public.is_superadmin()) with check (public.is_superadmin())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------- Reorder a chain's steps in one go ----------
-- (chain_id, step_order) is unique and checked row by row, so a plain swap would collide.
-- Pass 1 parks every step on a negative number, pass 2 writes the final 1..n order.
create or replace function public.reorder_prompt_chain_steps(p_chain_id bigint, p_step_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmins only';
  end if;
  if cardinality(p_step_ids) <> (select count(distinct x) from unnest(p_step_ids) as u(x))
     or cardinality(p_step_ids) <> (select count(*) from public.prompt_chain_steps where chain_id = p_chain_id)
     or exists (
       select 1 from unnest(p_step_ids) as u(sid)
       where not exists (select 1 from public.prompt_chain_steps s where s.id = u.sid and s.chain_id = p_chain_id)
     ) then
    raise exception 'step list must contain every step of chain % exactly once', p_chain_id;
  end if;

  update public.prompt_chain_steps s set step_order = -o.ord
  from unnest(p_step_ids) with ordinality as o(sid, ord) where s.id = o.sid;
  update public.prompt_chain_steps s set step_order = o.ord
  from unnest(p_step_ids) with ordinality as o(sid, ord) where s.id = o.sid;
end;
$$;

revoke all on function public.reorder_prompt_chain_steps(bigint, bigint[]) from public;
grant execute on function public.reorder_prompt_chain_steps(bigint, bigint[]) to authenticated;
