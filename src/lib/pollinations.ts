// Free text-to-image service (no key). The image step's own instructions supply the style.

export class RenderError extends Error {}

export function pollinationsUrl(prompt: string, seed: number, style = "") {
  const params = new URLSearchParams({ width: "1024", height: "768", seed: String(seed), nologo: "true" });
  const text = (style ? `${prompt}. ${style}` : prompt).slice(0, 1500);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?${params}`;
}

// The anonymous tier rate-limits bursts (HTTP 402/429), so retry with growing waits.
const RETRY_DELAYS_MS = [4_000, 8_000, 12_000];
const DEADLINE_MS = 40_000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attempt(url: string, fetchImpl: typeof fetch, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new RenderError("Image service timed out");
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    throw new RenderError(`Image service returned ${res.status} ${type}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) throw new RenderError("Image was empty");
  return { bytes, contentType: type.split(";")[0].trim() };
}

export async function renderImage(
  prompt: string,
  {
    seed = Math.floor(Math.random() * 1_000_000_000),
    style = "",
    fetchImpl = fetch,
    sleep = wait,
  }: { seed?: number; style?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
) {
  const url = pollinationsUrl(prompt, seed, style);
  const deadline = Date.now() + DEADLINE_MS;
  let lastError: unknown;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    if (i > 0) {
      const delay = RETRY_DELAYS_MS[i - 1];
      if (Date.now() + delay >= deadline) break;
      await sleep(delay);
    }
    try {
      const image = await attempt(url, fetchImpl, Math.max(1_000, deadline - Date.now()));
      return { ...image, seed };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof RenderError ? lastError : new RenderError("Image service unavailable");
}
