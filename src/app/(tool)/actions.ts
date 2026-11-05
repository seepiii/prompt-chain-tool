"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase-server";
import { moveId, slugify, type Step } from "@/lib/chains";
import { runSteps, type StepResult } from "@/lib/run-chain";
import { GenerationError } from "@/lib/gemini";

export type FormState = { error?: string; ok?: string; at?: number } | undefined;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const num = (form: FormData, key: string) => Number(form.get(key));
const optionalId = (form: FormData, key: string) => (form.get(key) ? num(form, key) : null);

// ---------- Chains ----------

export async function createChain(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(form, "name");
  if (!name) return { error: "Give the chain a name." };
  const slug = slugify(text(form, "slug") || name);
  if (!slug) return { error: "The name needs at least one letter or number." };

  const { data, error } = await supabase
    .from("prompt_chains")
    .insert({ name, slug, description: text(form, "description") || null })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? `A chain with the slug "${slug}" already exists.` : error.message };
  redirect(`/chains/${data.id}`);
}

export async function updateChain(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const id = num(form, "id");
  const name = text(form, "name");
  const slug = slugify(text(form, "slug"));
  if (!name || !slug) return { error: "Name and slug can't be empty." };

  const { error } = await supabase
    .from("prompt_chains")
    .update({ name, slug, description: text(form, "description") || null })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? `Another chain already uses "${slug}".` : error.message };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function deleteChain(form: FormData) {
  const { supabase } = await requireAdmin();
  // Steps, the mix weight and past runs go with it (on delete cascade).
  const { error } = await supabase.from("prompt_chains").delete().eq("id", num(form, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Steps ----------

async function stepIds(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], chainId: number) {
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select("id")
    .eq("chain_id", chainId)
    .order("step_order");
  if (error) throw new Error(error.message);
  return data.map((s) => s.id as number);
}

export async function createStep(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const chainId = num(form, "chain_id");
  const name = text(form, "name");
  const instructions = text(form, "instructions");
  if (!name || !instructions) return { error: "A step needs a name and instructions." };

  const position = num(form, "position");
  const ids = await stepIds(supabase, chainId);
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .insert({ chain_id: chainId, step_order: ids.length + 1, name, instructions, model_id: optionalId(form, "model_id") })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // "Insert at step N": add it at the end, then move it into place.
  if (position >= 1 && position <= ids.length) {
    const order = [...ids];
    order.splice(position - 1, 0, data.id);
    const { error: moveError } = await supabase.rpc("reorder_prompt_chain_steps", { p_chain_id: chainId, p_step_ids: order });
    if (moveError) return { error: moveError.message };
  }
  revalidatePath(`/chains/${chainId}`);
  return { ok: "Step added.", at: Date.now() };
}

export async function updateStep(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(form, "name");
  const instructions = text(form, "instructions");
  if (!name || !instructions) return { error: "A step needs a name and instructions." };

  const { error } = await supabase
    .from("prompt_chain_steps")
    .update({ name, instructions, model_id: optionalId(form, "model_id") })
    .eq("id", num(form, "id"));
  if (error) return { error: error.message };
  revalidatePath(`/chains/${num(form, "chain_id")}`);
  return { ok: "Saved." };
}

export async function deleteStep(form: FormData) {
  const { supabase } = await requireAdmin();
  const chainId = num(form, "chain_id");
  const { error } = await supabase.from("prompt_chain_steps").delete().eq("id", num(form, "id"));
  if (error) throw new Error(error.message);

  // Close the gap so the remaining steps read 1, 2, 3…
  const ids = await stepIds(supabase, chainId);
  if (ids.length) {
    const { error: renumberError } = await supabase.rpc("reorder_prompt_chain_steps", { p_chain_id: chainId, p_step_ids: ids });
    if (renumberError) throw new Error(renumberError.message);
  }
  revalidatePath(`/chains/${chainId}`);
}

export async function moveStep(form: FormData) {
  const { supabase } = await requireAdmin();
  const chainId = num(form, "chain_id");
  const ids = await stepIds(supabase, chainId);
  const next = moveId(ids, num(form, "id"), num(form, "delta") < 0 ? -1 : 1);
  if (next !== ids) {
    const { error } = await supabase.rpc("reorder_prompt_chain_steps", { p_chain_id: chainId, p_step_ids: next });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/chains/${chainId}`);
}

// ---------- Running a chain ----------

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function runChain(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY isn't set on the server." };

  const chainId = num(form, "chain_id");
  const inputText = text(form, "input_text");
  const file = form.get("image");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (!inputText && !upload) return { error: "Give the chain an image, some text, or both." };
  if (upload && !IMAGE_TYPES.has(upload.type)) return { error: "Images must be JPEG, PNG, WebP or GIF." };
  if (upload && upload.size > 4 * 1024 * 1024) return { error: "Images must be under 4 MB." };

  const { data: steps, error: stepsError } = await supabase
    .from("prompt_chain_steps")
    .select("id, step_order, name, instructions, model_id, llm_models(model_key, name, purpose)")
    .eq("chain_id", chainId)
    .order("step_order")
    .returns<Step[]>();
  if (stepsError) return { error: stepsError.message };
  if (!steps.length) return { error: "Add at least one step before running the chain." };

  const save = async (bytes: Buffer, contentType: string, kind: string) => {
    const path = `prompt-chain-runs/${user.id}/${kind}-${randomUUID()}.${EXT[contentType] ?? "png"}`;
    const { error } = await supabase.storage.from("reports").upload(path, bytes, { contentType });
    if (error) throw new Error(`Couldn't store the image: ${error.message}`);
    return supabase.storage.from("reports").getPublicUrl(path).data.publicUrl;
  };

  let image: { mimeType: string; base64: string } | null = null;
  let inputImageUrl: string | null = null;
  if (upload) {
    const bytes = Buffer.from(await upload.arrayBuffer());
    image = { mimeType: upload.type, base64: bytes.toString("base64") };
    inputImageUrl = await save(bytes, upload.type, "input");
  }

  const { data: run, error: runError } = await supabase
    .from("prompt_chain_runs")
    .insert({ chain_id: chainId, input_text: inputText || null, input_image_url: inputImageUrl })
    .select("id")
    .single();
  if (runError) return { error: runError.message };

  try {
    const out = await runSteps(steps, { text: inputText, image }, {
      apiKey,
      saveImage: (bytes, type) => save(bytes, type, "output"),
      onStep: async (result: StepResult) => {
        const { error } = await supabase.from("prompt_chain_run_steps").insert({ run_id: run.id, ...result });
        if (error) throw new Error(error.message);
      },
    });
    await supabase
      .from("prompt_chain_runs")
      .update({ status: "done", output_text: out.text, output_image_url: out.imageUrl, finished_at: new Date().toISOString() })
      .eq("id", run.id);
  } catch (e) {
    const message =
      e instanceof GenerationError && e.reason === "blocked"
        ? "The model declined this input (safety filter)."
        : e instanceof GenerationError
          ? "Gemini is busy right now. Try again in a minute."
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
    await supabase
      .from("prompt_chain_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
  }

  revalidatePath(`/chains/${chainId}`);
  redirect(`/runs/${run.id}`);
}
