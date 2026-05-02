import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeliveryPackagePendingHistory,
  buildDeliveryPackageQueueJob,
} from "../src/app/delivery-package-service.js";

test("delivery package service builds queue job and pending history", () => {
  const job = buildDeliveryPackageQueueJob({
    episode: { id: "e1", title: "第一集" },
    requestId: "pkg-1",
    packageContent: "{}",
  });
  const history = buildDeliveryPackagePendingHistory({
    packageEntry: { title: "第一集 工程包" },
    requestId: "pkg-1",
  });

  assert.equal(job.kind, "exportPackage");
  assert.equal(job.episodeId, "e1");
  assert.equal(history.status, "pending");
});
