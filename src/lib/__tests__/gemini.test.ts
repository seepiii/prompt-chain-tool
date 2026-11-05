import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateReport, GenerationError, resetCooldowns } from "../gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }));
const busy = () => new Response(JSON.stringify({ error: { code: 503 } }), { status: 503 });

const input = { system: "sys", user: "usr", apiKey: "k" };

describe("generateReport", () => {
  beforeEach(() => resetCooldowns());

  it("returns text and the model that answered", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("hello humans"));
    const r = await generateReport({ ...input, fetchImpl, models: ["m1"] });
    expect(r).toEqual({ text: "hello humans", model: "m1" });
  });

  it("falls back to the next model when one is busy", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok("hi"));
    const r = await generateReport({ ...input, fetchImpl, models: ["m1", "m2"] });
    expect(r.model).toBe("m2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("sends the image as inline data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("x"));
    await generateReport({
      ...input, fetchImpl, models: ["m1"],
      image: { mimeType: "image/jpeg", base64: "AAA" },
    });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: "image/jpeg", data: "AAA" } });
  });

  it("throws 'blocked' when safety filters stop the reply", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })),
    );
    await expect(generateReport({ ...input, fetchImpl, models: ["m1"] }))
      .rejects.toMatchObject({ reason: "blocked" });
  });

  it("throws 'unavailable' when every model is busy", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => busy());
    const err = await generateReport({ ...input, fetchImpl, models: ["m1", "m2"] }).catch((e) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.reason).toBe("unavailable");
  });

  it("skips a model that was busy moments ago", async () => {
    const first = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok("a"));
    await generateReport({ ...input, fetchImpl: first, models: ["m1", "m2"] });

    const second = vi.fn().mockResolvedValue(ok("b"));
    const r = await generateReport({ ...input, fetchImpl: second, models: ["m1", "m2"] });
    expect(r.model).toBe("m2");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("still tries cooled-down models if nothing else is left", async () => {
    await generateReport({
      ...input, models: ["m1"], fetchImpl: vi.fn().mockResolvedValue(busy()),
    }).catch(() => {});
    const r = await generateReport({ ...input, models: ["m1"], fetchImpl: vi.fn().mockResolvedValue(ok("c")) });
    expect(r.model).toBe("m1");
  });
  it("asks for JSON when json mode is on", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("{}"));
    await generateReport({ ...input, fetchImpl, models: ["m1"], json: true });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("keeps thinking low and leaves room for the answer", async () => {
    // Thinking models spend output tokens on reasoning; a small cap truncated replies mid-JSON.
    const fetchImpl = vi.fn().mockResolvedValue(ok("x"));
    await generateReport({ ...input, fetchImpl, models: ["m1"] });
    const cfg = JSON.parse(fetchImpl.mock.calls[0][1].body).generationConfig;
    expect(cfg.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(cfg.maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });
});
