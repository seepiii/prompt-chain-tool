import Link from "next/link";
import { requireAdmin } from "@/lib/supabase-server";
import RunCard, { type RunSummary } from "@/components/RunCard";

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { chain } = await searchParams;
  const chainId = Number(chain);
  const filtered = Number.isInteger(chainId) && chainId > 0;
  const { supabase } = await requireAdmin();

  const { data: chains } = await supabase.from("prompt_chains").select("id, name").order("id");
  let query = supabase
    .from("prompt_chain_runs")
    .select("id, status, error, input_text, input_image_url, output_text, output_image_url, created_at, prompt_chains(name)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (filtered) query = query.eq("chain_id", chainId);
  const { data: runs, error } = await query.returns<RunSummary[]>();
  if (error) throw new Error(error.message);

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-bold ${active ? "border-accent bg-accent-bg text-accent-fg" : "border-line text-muted hover:text-fg"}`;

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Generated media</h2>
        <p className="text-sm text-muted">Everything the chains have produced, newest first. Pick a chain to see only its results.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/media" className={pill(!filtered)}>All chains</Link>
        {(chains ?? []).map((c) => (
          <Link key={c.id} href={`/media?chain=${c.id}`} className={pill(filtered && c.id === chainId)}>
            {c.name}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((r) => (
          <RunCard key={r.id} run={r} />
        ))}
      </div>
      {!runs.length && <p className="text-sm text-muted">Nothing generated yet{filtered ? " by this chain" : ""}.</p>}
    </main>
  );
}
