import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBatchDeliveryPackagePlans,
  selectReadyEpisodesForBatchDelivery,
} from "../src/app/studio-delivery-scheduler.js";

test("studio delivery scheduler selects ready episodes and builds package plans", () => {
  const project = {
    episodes: [
      { id: "e1", title: "第一集", shots: [{ id: "S01", videoUrl: "a.mp4", reviewStatus: "已通过" }], timeline: { clips: [{ mediaUrl: "a.mp4" }] } },
      { id: "e2", title: "第二集", shots: [{ id: "S01", reviewStatus: "未审" }], timeline: { clips: [] } },
    ],
  };
  const ready = selectReadyEpisodesForBatchDelivery(project);
  const plans = buildBatchDeliveryPackagePlans({
    project,
    outputSpec: { platform: "douyin" },
    now: () => 123,
    buildPackageEntry: ({ episode }) => ({ title: `${episode.title} 工程包` }),
    buildPackageContent: ({ episode }) => JSON.stringify({ episodeId: episode.id }),
    safeFileName: (value) => value,
  });

  assert.deepEqual(ready.map((episode) => episode.id), ["e1"]);
  assert.equal(plans[0].requestId, "package-e1-123");
  assert.equal(plans[0].packageEntry.title, "第一集 工程包");
  assert.equal(plans[0].packageContent, "{\"episodeId\":\"e1\"}");
});
