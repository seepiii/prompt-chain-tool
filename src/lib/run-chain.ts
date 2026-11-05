import { generateReport, MODELS } from "./gemini";
import { renderImage } from "./pollinations";
import { isImageStep, modelOrder, type Step } from "./chains";

export type StepResult = {
  step_order: number;
  step_name: string;
  model_key: string | null;
  instructions: string;
  input: string;
  output_text: string | null;
  output_image_url: string | null;
  duration_ms: number;
};

type Image = { mimeType: string; base64: string };

type Deps = {
  apiKey: string;
  /** Stores a generated image and returns its public URL. */
  saveImage: (bytes: Buffer, contentType: string) => Promise<string>;
  /** Called after every step so a failure part-way still leaves the finished steps on record. */
  onStep: (result: StepResult) => Promise<void>;
  generate?: typeof generateReport;
  render?: typeof renderImage;
};

/**
 * Runs the steps in order. Each step gets the previous step's output:
 * a text step reads the latest text (plus the latest image, if the last thing produced was one),
 * an image step paints the latest text using its instructions as the style.
 */
export async function runSteps(
  steps: Step[],
  input: { text: string; image: Image | null },
  { apiKey, saveImage, onStep, generate = generateReport, render = renderImage }: Deps,
) {
  let text = input.text;
  let image = input.image;
  let imageUrl: string | null = null;

  for (const step of steps) {
    const started = Date.now();
    let result: StepResult;

    if (isImageStep(step)) {
      if (!text.trim()) throw new Error(`Step ${step.step_order} paints a picture but has no text to paint from.`);
      const painted = await render(text, { style: step.instructions });
      imageUrl = await saveImage(painted.bytes, painted.contentType);
      image = { mimeType: painted.contentType, base64: painted.bytes.toString("base64") };
      result = {
        step_order: step.step_order,
        step_name: step.name,
        model_key: step.llm_models?.model_key ?? null,
        instructions: step.instructions,
        input: text,
        output_text: null,
        output_image_url: imageUrl,
        duration_ms: Date.now() - started,
      };
    } else {
      const user = text.trim() || "Work from the attached image.";
      const out = await generate({
        system: step.instructions,
        user,
        apiKey,
        image: image ?? undefined,
        models: modelOrder(step.llm_models?.model_key, MODELS),
      });
      result = {
        step_order: step.step_order,
        step_name: step.name,
        model_key: out.model,
        instructions: step.instructions,
        input: image ? `${user}\n[+ image]` : user,
        output_text: out.text,
        output_image_url: null,
        duration_ms: Date.now() - started,
      };
      text = out.text;
      image = null; // later steps build on this text, not the old picture
    }

    await onStep(result);
  }

  return { text, imageUrl };
}
