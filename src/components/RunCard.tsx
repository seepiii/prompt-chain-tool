import Link from "next/link";

export type RunSummary = {
  id: number;
  status: "running" | "done" | "failed";
  error: string | null;
  input_text: string | null;
  input_image_url: string | null;
  output_text: string | null;
  output_image_url: string | null;
  created_at: string;
  prompt_chains?: { name: string } | null;
};

const STATUS = {
  done: "text-ok",
  failed: "text-danger",
  running: "text-muted",
} as const;

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

/** One generated result: the image it made (or was given) and the final text. */
export default function RunCard({ run }: { run: RunSummary }) {
  const picture = run.output_image_url ?? run.input_image_url;
  return (
    <Link href={`/runs/${run.id}`} className="panel flex flex-col overflow-hidden transition hover:border-accent">
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="aspect-[4/3] w-full bg-panel-2 object-cover" />
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`font-bold uppercase ${STATUS[run.status]}`}>{run.status}</span>
          <span className="text-muted">{when(run.created_at)}</span>
        </div>
        {run.prompt_chains && <span className="text-xs font-bold text-accent">{run.prompt_chains.name}</span>}
        <p className="line-clamp-5 text-sm whitespace-pre-wrap">
          {run.status === "failed" ? run.error : (run.output_text ?? run.input_text ?? "")}
        </p>
      </div>
    </Link>
  );
}
