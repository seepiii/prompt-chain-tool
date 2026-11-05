import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import { ChainForm } from "@/components/Forms";

export default async function ChainsPage() {
  const { supabase } = await requireAdmin();
  const { data: chains, error } = await supabase
    .from("prompt_chains")
    .select("id, slug, name, description, created_at, prompt_chain_steps(count), prompt_chain_runs(count)")
    .order("id");
  if (error) throw new Error(error.message);

  return (
    <main className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">Prompt chains</h2>
          <span className="text-sm text-muted">{chains.length} total</span>
        </div>
        <p className="text-sm text-muted">
          A chain runs its steps in order, and each step builds on the one before it. Open one to edit, reorder or run it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chains.map((c) => {
            const steps = (c.prompt_chain_steps as { count: number }[])[0]?.count ?? 0;
            const runs = (c.prompt_chain_runs as { count: number }[])[0]?.count ?? 0;
            return (
              <Link key={c.id} href={`/chains/${c.id}`} className="panel flex flex-col gap-2 p-5 transition hover:border-accent">
                <span className="font-mono text-xs text-muted">{c.slug}</span>
                <span className="text-lg font-bold">{c.name}</span>
                {c.description && <span className="line-clamp-2 text-sm text-muted">{c.description}</span>}
                <span className="mt-auto pt-2 text-xs font-bold text-accent">
                  {steps} step{steps === 1 ? "" : "s"} · {runs} run{runs === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
          {!chains.length && <p className="text-sm text-muted">No chains yet. Create the first one below.</p>}
        </div>
      </section>

      <section className="panel flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold">New prompt chain</h2>
        <ChainForm />
      </section>
    </main>
  );
}
