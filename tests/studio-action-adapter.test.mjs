import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveStudioActions,
} from "../src/app/studio-action-adapter.js";

test("studio action adapter maps legacy callbacks", () => {
  const legacy = () => "legacy";
  const actions = resolveStudioActions({
    onGenerateText: legacy,
    onOpenQueue: legacy,
    onStopQueue: legacy,
    onUploadShotImage: legacy,
    onUploadShotVideo: legacy,
  });

  assert.equal(actions.generateText(), "legacy");
  assert.equal(actions.openQueue(), "legacy");
  assert.equal(actions.stopQueue(), "legacy");
  assert.equal(actions.uploadShotImage(), "legacy");
  assert.equal(actions.uploadShotVideo(), "legacy");
  assert.equal(actions.generateImages, null);
});

test("studio action adapter prefers actions object over legacy callbacks", () => {
  const legacy = () => "legacy";
  const modern = () => "modern";
  const actions = resolveStudioActions({
    actions: {
      generateText: modern,
      openAdvancedCanvas: modern,
      stopQueue: modern,
      exportAssetsAndStoryboard: modern,
    },
    onGenerateText: legacy,
    onOpenAdvancedCanvas: legacy,
  });

  assert.equal(actions.generateText(), "modern");
  assert.equal(actions.openAdvancedCanvas(), "modern");
  assert.equal(actions.stopQueue(), "modern");
  assert.equal(actions.exportAssetsAndStoryboard(), "modern");
});
