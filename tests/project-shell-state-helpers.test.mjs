import assert from "node:assert/strict";
import test from "node:test";

import {
  ARCHIVE_STAGE_OPTIONS,
  archiveStateForStorage,
  collaborationStateForStorage,
  defaultArchiveState,
  defaultCollaborationMemberLabel,
  defaultCollaborationState,
  defaultPerformanceSettings,
  normalizeArchiveState,
  normalizeCollaborationState,
  normalizePerformanceSettings,
  performanceSettingsForStorage,
} from "../src/project-shell-state-helpers.js";

test("default collaboration state mirrors the project shell defaults", () => {
  const state = defaultCollaborationState();

  assert.equal(state.activeMemberId, "member-director");
  assert.equal(state.activeMemberName, "导演");
  assert.equal(defaultCollaborationMemberLabel(), "导演");
  assert.deepEqual(state.members, [
    { id: "member-director", name: "导演", role: "总导演" },
    { id: "member-writer", name: "编剧", role: "剧本" },
    { id: "member-editor", name: "审稿", role: "审核" },
  ]);
});

test("collaboration normalization selects the active member and caps activities", () => {
  const activities = Array.from({ length: 205 }, (_, index) => ({ id: `activity-${index}` }));
  const state = normalizeCollaborationState({
    activeMemberName: "美术",
    members: [
      { id: "lead", name: "制片", role: "统筹" },
      { id: "artist", name: "美术", role: "画面" },
    ],
    activities,
  });

  assert.equal(state.activeMemberId, "artist");
  assert.equal(state.activeMemberName, "美术");
  assert.equal(state.activities.length, 200);
  assert.deepEqual(collaborationStateForStorage(state), state);
});

test("archive normalization falls back and caps snapshots", () => {
  assert.deepEqual(defaultArchiveState(), {
    deliveryNote: "",
    milestoneIds: [],
    snapshots: [],
  });

  const snapshots = Array.from({ length: 45 }, (_, index) => ({ id: `snapshot-${index}` }));
  const state = normalizeArchiveState({
    deliveryNote: "交付说明",
    milestoneIds: "bad",
    snapshots,
  });

  assert.equal(state.deliveryNote, "交付说明");
  assert.deepEqual(state.milestoneIds, []);
  assert.equal(state.snapshots.length, 40);
  assert.deepEqual(archiveStateForStorage(state), state);
  assert.deepEqual(ARCHIVE_STAGE_OPTIONS, ["开发中", "内测版", "交付版", "归档"]);
});

test("performance settings normalize mode and minimap visibility", () => {
  assert.deepEqual(defaultPerformanceSettings(), {
    mode: "auto",
    showMinimap: true,
  });

  assert.deepEqual(normalizePerformanceSettings({ mode: "quality", showMinimap: false }), {
    mode: "quality",
    showMinimap: false,
  });
  assert.deepEqual(normalizePerformanceSettings({ mode: "invalid" }), {
    mode: "auto",
    showMinimap: true,
  });
  assert.deepEqual(performanceSettingsForStorage({ mode: "lite", showMinimap: true }), {
    mode: "lite",
    showMinimap: true,
  });
});
