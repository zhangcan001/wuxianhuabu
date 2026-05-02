import assert from "node:assert/strict";
import test from "node:test";
import {
  createMockProvider,
  createProviderGateway,
  listProviders,
  registerProvider,
  resolveProvider,
  runProviderRequest,
} from "../src/core/providers/provider-gateway.js";

test("provider gateway resolves providers by capability and default", async () => {
  const gateway = createProviderGateway([
    createMockProvider({ id: "mock-image", capabilities: ["image"] }),
    createMockProvider({ id: "mock-video", capabilities: ["video"] }),
  ], {
    defaultProviderByCapability: { image: "mock-image" },
  });

  assert.equal(listProviders(gateway, "image").length, 1);
  assert.equal(resolveProvider(gateway, { capability: "image" }).id, "mock-image");

  const result = await runProviderRequest(gateway, {
    capability: "image",
    input: { prompt: "雨夜车站" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.providerId, "mock-image");
  assert.equal(result.output.text, "雨夜车站");
});

test("provider gateway can register providers immutably", () => {
  const gateway = createProviderGateway();
  const next = registerProvider(gateway, createMockProvider({ id: "text", capabilities: ["text"] }));

  assert.equal(listProviders(gateway).length, 0);
  assert.equal(listProviders(next, "text").length, 1);
});

test("provider gateway normalizes validation and runtime failures", async () => {
  const gateway = createProviderGateway([
    createMockProvider({
      id: "bad",
      capabilities: ["image"],
      validateInput: () => ({ ok: false, error: "缺少提示词" }),
    }),
    createMockProvider({
      id: "throws",
      capabilities: ["video"],
      run: () => {
        const error = new Error("模型超时");
        error.retryable = true;
        throw error;
      },
    }),
  ]);

  const invalid = await runProviderRequest(gateway, { providerId: "bad", capability: "image", input: {} });
  const failed = await runProviderRequest(gateway, { providerId: "throws", capability: "video", input: { prompt: "推进" } });

  assert.equal(invalid.ok, false);
  assert.match(invalid.error.message, /缺少提示词/);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.retryable, true);
});
