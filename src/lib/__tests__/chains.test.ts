import { describe, expect, it, vi } from "vitest";
import { modelOrder, moveId, slugify, type Step } from "../chains";
import { runSteps } from "../run-chain";

describe("moveId", () => {
  it("moves a step up and down", () => {
    expect(moveId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
  });

  it("leaves the ends and unknown ids alone", () => {
    expect(moveId([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(moveId([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
    expect(moveId([1, 2, 3], 9, 1)).toEqual([1, 2, 3]);
  });
});

describe("slugify", () => {
  it("makes a url-safe slug", () => {
    expect(slugify("Image → Funny Captions!")).toBe("image-funny-captions");
  });
});

describe("modelOrder", () => {
  it("puts the chosen model first without repeating it", () => {
    expect(modelOrder("b", ["a", "b", "c"])).toEqual(["b", "a", "c"]);
    expect(modelOrder(undefined, ["a"])).toEqual(["a"]);
  });
});

const step = (order: number, purpose: string, instructions = `do ${order}`): Step => ({
  id: order,
  step_order: order,
  name: `Step ${order}`,
  instructions,
  model_id: order,
  llm_models: { model_key: purpose === "image" ? "pollinations" : "m", name: "M", purpose },
});

describe("runSteps", () => {
  const image = { mimeType: "image/png", base64: "AAAA" };

  it("feeds each step the previous output, and only step 1 sees the uploaded image", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ text: "a dog on a skateboard", model: "m" })
      .mockResolvedValueOnce({ text: "the dog has a mortgage", model: "m" })
      .mockResolvedValueOnce({ text: "1. caption", model: "m" });
    const onStep = vi.fn();
    const out = await runSteps([step(1, "vision"), step(2, "text"), step(3, "text")], { text: "", image }, {
      apiKey: "k",
      saveImage: vi.fn(),
      onStep,
      generate,
    });

    expect(generate.mock.calls[0][0]).toMatchObject({ system: "do 1", image });
    expect(generate.mock.calls[1][0]).toMatchObject({ system: "do 2", user: "a dog on a skateboard", image: undefined });
    expect(generate.mock.calls[2][0].user).toBe("the dog has a mortgage");
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(out).toEqual({ text: "1. caption", imageUrl: null });
  });

  it("paints from the previous text with the step's instructions as style", async () => {
    const generate = vi.fn().mockResolvedValue({ text: "a cat astronaut", model: "m" });
    const render = vi.fn().mockResolvedValue({ bytes: Buffer.from("png"), contentType: "image/png", seed: 1 });
    const saveImage = vi.fn().mockResolvedValue("https://img/1.png");
    const onStep = vi.fn();
    const out = await runSteps([step(1, "text"), step(2, "image", "watercolor")], { text: "space", image: null }, {
      apiKey: "k",
      saveImage,
      onStep,
      generate,
      render,
    });

    expect(render).toHaveBeenCalledWith("a cat astronaut", { style: "watercolor" });
    expect(onStep.mock.calls[1][0]).toMatchObject({ output_image_url: "https://img/1.png", output_text: null });
    expect(out.imageUrl).toBe("https://img/1.png");
  });
});
