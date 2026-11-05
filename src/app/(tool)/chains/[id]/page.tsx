import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase-server";
import { ChainForm, RunForm, StepForm } from "@/components/Forms";
import RunCard, { type RunSummary } from "@/components/RunCard";
import { isImageStep, type Model, type Step } from "@/lib/chains";
import { deleteChain, deleteStep, moveStep } from "../../actions";

// Running a chain happens in a Server Action on this page; several model calls in a row need time.
export const maxDuration = 300;

export default async function ChainPage({ params }: PageProps<"/chains/[id]">) {
  const { id } = await params;
  const chainId = Number(id);
  if (!Number.isInteger(chainId)) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: chain }, { data: steps }, { data: models }, { data: runs }] = await Promise.all([
    supabase.from("prompt_chains").select("id, slug, name, description").eq("id", chainId).maybeSingle(),
    supabase
      .from("prompt_chain_steps")
      .select("id, step_order, name, instructions, model_id, llm_models(model_key, name, purpose)")
      .eq("chain_id", chainId)
      .order("step_order")
      .returns<Step[]>(),
    supabase
      .from("llm_models")
      .select("id, name, model_key, purpose")
      .eq("is_active", true)
      .order("purpose")
      .order("fallback_order")
      .returns<Model[]>(),
    supabase
      .from("prompt_chain_runs")
      .select("id, status, error, input_text, input_image_url, output_text, output_image_url, created_at")
      .eq("chain_id", chainId)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<RunSummary[]>(),
  ]);
  if (!chain) notFound();
  const stepList = steps ?? [];

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-muted hover:text-fg">← All chains</Link>
        <h2 className="text-2xl font-bold">{chain.name}</h2>
        <p className="font-mono text-xs text-muted">{chain.slug}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Steps</h3>
        <ol className="flex flex-col gap-3">
          {stepList.map((step, i) => (
            <li key={step.id} className="panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg text-sm font-black text-accent-fg">
                  {step.step_order}
                </span>
                <span className="font-bold">{step.name}</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  {step.llm_models ? step.llm_models.name : "Default model"} ·{" "}
                  {isImageStep(step) ? "paints an image" : "writes text"}
                </span>
                <div className="ml-auto flex gap-1">
                  <form action={moveStep}>
                    <input type="hidden" name="chain_id" value={chainId} />
                    <input type="hidden" name="id" value={step.id} />
                    <input type="hidden" name="delta" value="-1" />
                    <button disabled={i === 0} aria-label={`Move step ${step.step_order} up`} className="btn px-2.5 py-1">
                      ↑
                    </button>
                  </form>
                  <form action={moveStep}>
                    <input type="hidden" name="chain_id" value={chainId} />
                    <input type="hidden" name="id" value={step.id} />
                    <input type="hidden" name="delta" value="1" />
                    <button
                      disabled={i === stepList.length - 1}
                      aria-label={`Move step ${step.step_order} down`}
                      className="btn px-2.5 py-1"
                    >
                      ↓
                    </button>
                  </form>
                </div>
              </div>
              <p className="font-mono text-[0.8rem] whitespace-pre-wrap text-muted">{step.instructions}</p>
              <details className="group">
                <summary className="cursor-pointer text-sm font-bold text-accent">Edit step</summary>
                <div className="mt-3 flex flex-col gap-4 border-t border-line pt-4">
                  <StepForm chainId={chainId} models={models ?? []} step={step} />
                  <details>
                    <summary className="cursor-pointer text-sm text-danger">Delete this step…</summary>
                    <form action={deleteStep} className="mt-2 flex items-center gap-3">
                      <input type="hidden" name="chain_id" value={chainId} />
                      <input type="hidden" name="id" value={step.id} />
                      <span className="text-sm text-muted">The steps after it move up one.</span>
                      <button className="btn btn-danger">Yes, delete step {step.step_order}</button>
                    </form>
                  </details>
                </div>
              </details>
            </li>
          ))}
          {!stepList.length && <p className="text-sm text-muted">No steps yet. Add the first one below.</p>}
        </ol>

        <div className="panel flex flex-col gap-3 border-dashed p-5">
          <h4 className="font-bold">Add a step</h4>
          <StepForm chainId={chainId} models={models ?? []} stepCount={stepList.length} />
        </div>
      </section>

      <section className="panel flex flex-col gap-4 p-6">
        <h3 className="text-lg font-bold">Generate</h3>
        <p className="text-sm text-muted">Run every step in order and save what each one produced.</p>
        <RunForm chainId={chainId} disabled={!stepList.length} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-bold">Media from this chain</h3>
          <Link href={`/media?chain=${chainId}`} className="text-sm font-bold text-accent">See all →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(runs ?? []).map((r) => (
            <RunCard key={r.id} run={r} />
          ))}
        </div>
        {!runs?.length && <p className="text-sm text-muted">Nothing generated yet.</p>}
      </section>

      <section className="panel flex flex-col gap-4 p-6">
        <h3 className="text-lg font-bold">Chain details</h3>
        <ChainForm chain={chain} />
        <details className="border-t border-line pt-4">
          <summary className="cursor-pointer text-sm text-danger">Delete this chain…</summary>
          <form action={deleteChain} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={chainId} />
            <span className="text-sm text-muted">Its {stepList.length} steps and all of its generated media are deleted too.</span>
            <button className="btn btn-danger">Yes, delete “{chain.name}”</button>
          </form>
        </details>
      </section>
    </main>
  );
}
