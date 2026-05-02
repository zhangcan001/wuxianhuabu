import assert from "node:assert/strict";
import test from "node:test";

import { buildShotTimelinePayload } from "../src/node-action-helpers.js";

test("buildShotTimelinePayload keeps Comfy preview url separate from local path", () => {
  const [clip] = buildShotTimelinePayload({
    nodeId: "shot-node",
    shots: [{
      id: "S01",
      imageResultUrl: "asset://C:/cache/comfy.png",
      imagePath: "C:/cache/comfy.png",
      lastQueueResult: "C:/cache/comfy.png",
    }],
    normalizeShotRecord: (shot) => ({
      status: "已生成",
      keyPropTokens: [],
      assetRefs: [],
      ...shot,
    }),
  });

  assert.equal(clip.mediaUrl, "asset://C:/cache/comfy.png");
  assert.equal(clip.mediaPath, "C:/cache/comfy.png");
  assert.equal(clip.mediaType, "image");
});
