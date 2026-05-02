import test from "node:test";
import assert from "node:assert/strict";
import {
  runFullChainCheckAction,
} from "../src/app/full-chain-check-action.js";

test("full chain check records delivery-ready result", () => {
  const calls = [];
  const result = runFullChainCheckAction({
    syncTimelineFromShots: () => ({ synced: true }),
    productionAppService: {
      runReview: (input) => {
        calls.push(["review", input.reviewOptions.reviewer, input.reviewOptions.reviewedAt]);
        return { events: ["reviewed"] };
      },
      planDelivery: (input) => {
        calls.push(["delivery", input.events, input.deliveryOptions.outputSpec.platform]);
        return { events: ["delivered"], delivery: { ok: true, readiness: { blockers: [] } } };
      },
    },
    commercialProject: { id: "project-1" },
    productionEvents: ["start"],
    productionState: { project: { productionBible: { outputSpec: { aspectRatio: "9:16" } } } },
    buildStudioDeliveryOutputSpec: () => ({ platform: "douyin" }),
    setProductionEvents: (events) => calls.push(["events", events]),
    openProductionStudioView: (view, message) => calls.push(["view", view, message]),
    now: () => "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.summary, "全链路验证通过。");
  assert.deepEqual(calls, [
    ["review", "chain-check", "2026-01-01T00:00:00.000Z"],
    ["delivery", ["reviewed"], "douyin"],
    ["events", ["delivered"]],
    ["view", "delivery", "全链路验证完成：审片与交付事件已归档，当前集可进入导出。"],
  ]);
});

test("full chain check opens review when delivery has blockers", () => {
  const calls = [];
  const result = runFullChainCheckAction({
    syncTimelineFromShots: () => null,
    productionAppService: {
      runReview: () => ({ events: ["reviewed"] }),
      planDelivery: () => ({ delivery: { ok: false, readiness: { blockers: ["缺视频", "未审片"] } } }),
    },
    productionEvents: ["start"],
    buildStudioDeliveryOutputSpec: () => ({ platform: "douyin" }),
    setProductionEvents: (events) => calls.push(["events", events]),
    openProductionStudioView: (view, message) => calls.push(["view", view, message]),
  });

  assert.equal(result.summary, "还有 2 个交付阻塞。");
  assert.deepEqual(calls, [
    ["events", ["start"]],
    ["view", "review", "全链路验证完成：还有 2 个交付阻塞。"],
  ]);
});
