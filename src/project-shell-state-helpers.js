export const DEFAULT_COLLABORATORS = [
  { id: "member-director", name: "导演", role: "总导演" },
  { id: "member-writer", name: "编剧", role: "剧本" },
  { id: "member-editor", name: "审稿", role: "审核" },
];

export const ARCHIVE_STAGE_OPTIONS = ["开发中", "内测版", "交付版", "归档"];

export function defaultCollaborationState() {
  return {
    activeMemberId: DEFAULT_COLLABORATORS[0].id,
    activeMemberName: DEFAULT_COLLABORATORS[0].name,
    members: DEFAULT_COLLABORATORS.map((member) => ({ ...member })),
    activities: [],
  };
}

export function defaultCollaborationMemberLabel() {
  return defaultCollaborationState().activeMemberName;
}

export function normalizeCollaborationState(state) {
  const source = state && typeof state === "object" ? state : defaultCollaborationState();
  const members = Array.isArray(source.members) && source.members.length
    ? source.members.map((member, index) => ({
      id: member.id || `member-${index + 1}`,
      name: member.name || `成员${index + 1}`,
      role: member.role || "成员",
    }))
    : defaultCollaborationState().members;
  const activeMember = members.find((member) => member.id === source.activeMemberId) || members.find((member) => member.name === source.activeMemberName) || members[0];
  return {
    activeMemberId: activeMember?.id || "",
    activeMemberName: activeMember?.name || "",
    members,
    activities: Array.isArray(source.activities) ? source.activities.slice(0, 200) : [],
  };
}

export function collaborationStateForStorage(state) {
  return normalizeCollaborationState(state);
}

export function defaultArchiveState() {
  return {
    deliveryNote: "",
    milestoneIds: [],
    snapshots: [],
  };
}

export function normalizeArchiveState(state) {
  const source = state && typeof state === "object" ? state : defaultArchiveState();
  return {
    deliveryNote: source.deliveryNote || "",
    milestoneIds: Array.isArray(source.milestoneIds) ? source.milestoneIds : [],
    snapshots: Array.isArray(source.snapshots) ? source.snapshots.slice(0, 40) : [],
  };
}

export function archiveStateForStorage(state) {
  return normalizeArchiveState(state);
}

export function defaultPerformanceSettings() {
  return {
    mode: "auto",
    showMinimap: true,
  };
}

export function normalizePerformanceSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : defaultPerformanceSettings();
  return {
    mode: ["auto", "quality", "lite"].includes(source.mode) ? source.mode : "auto",
    showMinimap: source.showMinimap !== false,
  };
}

export function performanceSettingsForStorage(settings) {
  return normalizePerformanceSettings(settings);
}
