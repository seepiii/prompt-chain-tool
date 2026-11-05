// Best model first; fall back when Google reports high demand or rate limits.
export const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

const RETRYABLE = new Set([404, 429, 500, 503]);
const COOLDOWN_MS = 2 * 60 * 1000;
const FAST_TIMEOUT_MS = 10_000; // busy models sometimes hang instead of returning 503
const LAST_TIMEOUT_MS = 25_000;

// Models that just failed are skipped for a couple of minutes (per server instance).
const cooldownUntil = new Map<string, number>();

export function resetCooldowns() {
  cooldownUntil.clear();
}

function coolDown(model: string) {
  cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
}

export class GenerationError extends Error {
  constructor(
    public reason: "blocked" | "unavailable" | "empty",
    message: string,
  ) {
    super(message);
  }
}

type Input = {
  system: string;
  user: string;
  apiKey: string;
  image?: { mimeType: string; base64: string };
  models?: string[];
  fetchImpl?: typeof fetch;
  json?: boolean;
};

export async function generateReport({
  system,
  user,
  apiKey,
  image,
  models = MODELS,
  fetchImpl = fetch,
  json = false,
}: Input): Promise<{ text: string; model: string }> {
  const parts: object[] = [{ text: user }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 1,
      // Thinking models spend output tokens on reasoning, so keep it low and leave headroom;
      // the prompts themselves cap the reply length.
      thinkingConfig: { thinkingLevel: "low" },
      maxOutputTokens: 2048,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });

  // Healthy models first; recently failed ones stay at the back as a last resort.
  const now = Date.now();
  const ordered = [
    ...models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now),
    ...models.filter((m) => (cooldownUntil.get(m) ?? 0) > now),
  ];

  let lastStatus = 0;
  for (const [i, model] of ordered.entries()) {
    const isLast = i === ordered.length - 1;
    let res: Response;
    try {
      res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: AbortSignal.timeout(isLast ? LAST_TIMEOUT_MS : FAST_TIMEOUT_MS),
        },
      );
    } catch {
      coolDown(model); // network error or timeout: try the next model
      continue;
    }

    if (!res.ok) {
      lastStatus = res.status;
      if (RETRYABLE.has(res.status)) {
        coolDown(model);
        continue;
      }
      throw new GenerationError("unavailable", `Gemini returned ${res.status}`);
    }

    const data = await res.json();
    if (data.promptFeedback?.blockReason) {
      throw new GenerationError("blocked", data.promptFeedback.blockReason);
    }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new GenerationError("blocked", "SAFETY");
    }
    const text = (candidate?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new GenerationError("empty", "Model returned no text");
    cooldownUntil.delete(model);
    return { text, model };
  }

  throw new GenerationError("unavailable", `All models busy (last status ${lastStatus})`);
}
