import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase-server";
import { when } from "@/components/RunCard";

type RunStep = {
  id: number;
  step_order: number;
  step_name: string;
  model_key: string | null;
  instructions: string;
  input: string | null;
  output_text: string | null;
  output_image_url: string | null;
  duration_ms: number | null;
};

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) notFound();
  const { supabase } = await requireAdmin();

  const { data: run } = await supabase
    .from("prompt_chain_runs")
    .select("id, chain_id, status, error, input_text, input_image_url, output_text, output_image_url, created_at, prompt_chains(name)")
    .eq("id", runId)
    .maybeSingle<{
      id: number;
      chain_id: number;
      status: string;
      error: string | null;
      input_text: string | null;
      input_image_url: string | null;
      output_text: string | null;
      output_image_url: string | null;
      created_at: string;
      prompt_chains: { name: string } | null;
    }>();
  if (!run) notFound();
  const { data: steps } = await supabase
    .from("prompt_chain_run_steps")
    .select("id, step_order, step_name, model_key, instructions, input, output_text, output_image_url, duration_ms")
    .eq("run_id", runId)
    .order("step_order")
    .returns<RunStep[]>();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/chains/${run.chain_id}`} className="text-sm text-muted hover:text-fg">
          ← {run.prompt_chains?.name ?? "Chain"}
        </Link>
        <h2 className="text-2xl font-bold">Run #{run.id}</h2>
        <p className="text-sm text-muted">{when(run.created_at)}</p>
      </div>

      {run.status === "failed" && (
        <p className="rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger">
          Stopped part-way: {run.error} The steps that finished are shown below.
        </p>
      )}

      <section className="panel grid gap-5 p-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="label">Input</span>
          {run.input_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={run.input_image_url} alt="Input" className="max-h-72 w-full rounded-lg bg-panel-2 object-contain" />
          )}
          {run.input_text && <p className="text-sm whitespace-pre-wrap">{run.input_text}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Final output</span>
          {run.output_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={run.output_image_url} alt="Generated" className="max-h-72 w-full rounded-lg bg-panel-2 object-contain" />
          )}
          {run.output_text && <p className="text-sm whitespace-pre-wrap">{run.output_text}</p>}
          {run.status !== "done" && !run.output_text && <p className="text-sm text-muted">No final output.</p>}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Step by step</h3>
        {(steps ?? []).map((s) => (
          <article key={s.id} className="panel flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg text-sm font-black text-accent-fg">
                {s.step_order}
              </span>
              <span className="font-bold">{s.step_name}</span>
              <span className="text-xs text-muted">
                {s.model_key ?? "default"}
                {s.duration_ms != null && ` · ${(s.duration_ms / 1000).toFixed(1)}s`}
              </span>
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-bold text-muted">Instructions and input</summary>
              <p className="mt-2 font-mono text-[0.8rem] whitespace-pre-wrap text-muted">{s.instructions}</p>
              {s.input && <p className="mt-2 border-l-2 border-line pl-3 text-sm whitespace-pre-wrap text-muted">{s.input}</p>}
            </details>
            {s.output_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.output_image_url} alt={`Step ${s.step_order} output`} className="max-h-96 rounded-lg object-contain" />
            )}
            {s.output_text && <p className="text-sm whitespace-pre-wrap">{s.output_text}</p>}
          </article>
        ))}
      </section>
    </main>
  );
}
