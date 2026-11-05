// Pure helpers shared by the pages, the actions and the runner (no Supabase, no fetch).

export type Model = { id: number; name: string; model_key: string; purpose: string };

export type Step = {
  id: number;
  step_order: number;
  name: string;
  instructions: string;
  model_id: number | null;
  llm_models: Pick<Model, "model_key" | "name" | "purpose"> | null;
};

/** "Image → Funny Captions!" → "image-funny-captions" */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Moves one id up (-1) or down (+1) in an ordered list. Out-of-range moves return the list unchanged. */
export function moveId(ids: number[], id: number, delta: -1 | 1) {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Image steps paint a picture from the previous output; every other model writes text. */
export function isImageStep(step: Pick<Step, "llm_models">) {
  return step.llm_models?.purpose === "image";
}

/** The step's chosen text model first, then the usual fallbacks without repeating it. */
export function modelOrder(chosen: string | undefined, fallbacks: string[]) {
  return chosen ? [chosen, ...fallbacks.filter((m) => m !== chosen)] : fallbacks;
}
