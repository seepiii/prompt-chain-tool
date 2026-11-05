"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createChain, createStep, runChain, updateChain, updateStep, type FormState } from "@/app/(tool)/actions";
import type { Model, Step } from "@/lib/chains";

function Submit({ children, pending: pendingText, primary = true }: { children: string; pending: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`btn ${primary ? "btn-primary" : ""}`}>
      {pending ? pendingText : children}
    </button>
  );
}

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm text-danger">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-ok">{state.ok}</p>;
  return null;
}

function Labelled({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

type ChainFields = { id: number; name: string; slug: string; description: string | null };

export function ChainForm({ chain }: { chain?: ChainFields }) {
  const [state, action] = useActionState(chain ? updateChain : createChain, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {chain && <input type="hidden" name="id" value={chain.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Name">
          <input name="name" required defaultValue={chain?.name} placeholder="Photo → captions" className="field" />
        </Labelled>
        <Labelled label="Slug" hint={chain ? undefined : "Optional. Made from the name if left blank."}>
          <input name="slug" required={!!chain} defaultValue={chain?.slug} placeholder="photo-captions" className="field font-mono" />
        </Labelled>
      </div>
      <Labelled label="Description">
        <textarea name="description" rows={2} defaultValue={chain?.description ?? ""} className="field" />
      </Labelled>
      <div className="flex items-center gap-3">
        <Submit pending="Saving…">{chain ? "Save chain" : "Create chain"}</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

function ModelSelect({ models, value }: { models: Model[]; value?: number | null }) {
  return (
    <select name="model_id" defaultValue={value ?? ""} className="field">
      <option value="">Default (Gemini, with fallbacks)</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} · {m.purpose === "image" ? "paints an image" : "writes text"}
        </option>
      ))}
    </select>
  );
}

export function StepForm({
  chainId,
  models,
  step,
  stepCount,
}: {
  chainId: number;
  models: Model[];
  step?: Step;
  stepCount?: number;
}) {
  const [state, action] = useActionState(step ? updateStep : createStep, undefined);
  return (
    // key resets the "new step" form after each successful add
    <form key={step ? step.id : (state?.at ?? "new")} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="chain_id" value={chainId} />
      {step && <input type="hidden" name="id" value={step.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Labelled label="Step name">
          <input name="name" required defaultValue={step?.name} placeholder="Describe the image" className="field" />
        </Labelled>
        <Labelled label="Model">
          <ModelSelect models={models} value={step?.model_id} />
        </Labelled>
        {!step && (
          <Labelled label="Position">
            <select name="position" defaultValue={(stepCount ?? 0) + 1} className="field">
              {Array.from({ length: (stepCount ?? 0) + 1 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i === (stepCount ?? 0) ? `Last (step ${i + 1})` : `Step ${i + 1}`}
                </option>
              ))}
            </select>
          </Labelled>
        )}
      </div>
      <Labelled
        label="Instructions"
        hint="Sent as the system prompt. The step's input is the previous step's output (step 1 gets your image and text). For an image model, these are the art style."
      >
        <textarea
          name="instructions"
          required
          rows={step ? 4 : 3}
          defaultValue={step?.instructions}
          placeholder="Describe what is in the image in two plain sentences."
          className="field font-mono text-[0.8rem]"
        />
      </Labelled>
      <div className="flex items-center gap-3">
        <Submit pending="Saving…" primary={!step}>
          {step ? "Save step" : "Add step"}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function RunForm({ chainId, disabled }: { chainId: number; disabled: boolean }) {
  const [state, action] = useActionState(runChain, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="chain_id" value={chainId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Image" hint="JPEG, PNG, WebP or GIF, under 4 MB. Goes to step 1.">
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" className="field" />
        </Labelled>
        <Labelled label="Text" hint="Optional with an image. Also goes to step 1.">
          <textarea name="input_text" rows={3} placeholder="A pigeon guarding a bagel on Broadway" className="field" />
        </Labelled>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RunButton disabled={disabled} />
        <Status state={state} />
      </div>
    </form>
  );
}

function RunButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button disabled={disabled || pending} className="btn btn-primary">
        {pending ? "Running the chain…" : "▶ Generate"}
      </button>
      {pending && <span className="text-sm text-muted">Each step waits for the one before it. This can take a minute.</span>}
      {disabled && !pending && <span className="text-sm text-muted">Add a step first.</span>}
    </>
  );
}
