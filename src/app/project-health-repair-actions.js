export function buildHealthFindingKey(finding) {
  return `${finding?.category || ""}-${finding?.text || ""}-${finding?.nodeId || ""}-${finding?.fix?.kind || ""}`;
}

export function createHealthRepairLogEntry(entry = {}, options = {}) {
  const now = options.now || (() => Date.now());
  const idSuffix = options.idSuffix || (() => Math.random().toString(36).slice(2, 7));
  const formatTime = options.formatTime || ((date) => new Date(date).toLocaleString());
  const createdAt = now();
  return {
    id: `health-repair-${createdAt}-${idSuffix()}`,
    at: formatTime(createdAt),
    status: entry?.status || "done",
    findingText: entry?.findingText || "",
    category: entry?.category || "",
    episodeName: entry?.episodeName || "",
    action: entry?.action || "",
    detail: entry?.detail || "",
    nodeId: entry?.nodeId || "",
  };
}

export function prependHealthRepairLog(log = [], entry = {}, options = {}) {
  return [createHealthRepairLogEntry(entry, options), ...(Array.isArray(log) ? log : [])].slice(0, options.limit || 24);
}

export function filterHealthRemainingKeys(refreshedReport, currentKeys = [], preferredKeys = null, options = {}) {
  const keyOf = options.buildKey || buildHealthFindingKey;
  const available = new Set((refreshedReport?.findings || []).map((item) => keyOf(item)));
  const base = Array.isArray(preferredKeys) ? preferredKeys : currentKeys;
  return [...new Set((base || []).filter((key) => available.has(key)))];
}

export async function fixHealthFindingAction({
  finding,
  pushHistory = () => {},
  autoFixHealthFinding = async () => {},
  appendHealthRepairLog = () => {},
  setHealthFixingKeys = () => {},
  setProjectMessage = () => {},
  buildKey = buildHealthFindingKey,
} = {}) {
  const key = buildKey(finding);
  setHealthFixingKeys((current) => current.includes(key) ? current : [...current, key]);
  try {
    pushHistory();
    await autoFixHealthFinding(finding);
    return { ok: true, key };
  } catch (error) {
    appendHealthRepairLog(buildFailedHealthRepairLogEntry(finding, error));
    setProjectMessage(`自动修复失败：${error?.message || String(error)}`);
    return { ok: false, key, error };
  } finally {
    setHealthFixingKeys((current) => current.filter((item) => item !== key));
  }
}

export async function fixHealthFindingsBatchAction({
  findings = [],
  fixHealthFinding = async () => ({ ok: false }),
  buildRefreshedReport = () => ({ findings: [] }),
  syncHealthRemainingKeys = () => {},
  appendHealthRepairLog = () => {},
  setProjectMessage = () => {},
  getEpisodeName = () => "当前集",
  buildKey = buildHealthFindingKey,
} = {}) {
  const targets = (findings || []).filter((item) => item.fix?.kind);
  if (!targets.length) {
    setProjectMessage("当前筛选下没有可自动修复的问题。");
    return { success: 0, failed: 0, remaining: 0, targets: [] };
  }

  let success = 0;
  let failed = 0;
  const failedTexts = [];
  for (const finding of targets) {
    // eslint-disable-next-line no-await-in-loop
    const result = await fixHealthFinding(finding);
    if (result?.ok) success += 1;
    else {
      failed += 1;
      if (finding?.text) failedTexts.push(finding.text);
    }
  }

  const refreshedReport = buildRefreshedReport();
  const remainingKeys = targets
    .filter((finding) => refreshedReport.findings?.some((item) => buildKey(item) === buildKey(finding)))
    .map((finding) => buildKey(finding));
  const remaining = remainingKeys.length;
  syncHealthRemainingKeys(refreshedReport, remainingKeys);
  appendHealthRepairLog(buildBatchHealthRepairLogEntry({
    success,
    failed,
    remaining,
    failedTexts,
    episodeName: getEpisodeName(),
  }));
  setProjectMessage(`批量修复完成：成功 ${success} 条，失败 ${failed} 条，剩余 ${remaining} 条`);
  return { success, failed, remaining, targets, failedTexts, remainingKeys, refreshedReport };
}

export async function reconcileHealthRepairAction({
  finding,
  refreshGeneratedImagesIntoAssets = () => {},
  waitForCommit = async () => {},
  buildRefreshedReport = () => ({ findings: [] }),
  getRemainingKeys = () => [],
  syncHealthRemainingKeys = () => {},
  appendHealthRepairLog = () => {},
  buildKey = buildHealthFindingKey,
} = {}) {
  refreshGeneratedImagesIntoAssets();
  await waitForCommit();
  const refreshedReport = buildRefreshedReport();
  const key = buildKey(finding);
  const unresolved = refreshedReport.findings?.some((item) => buildKey(item) === key);
  if (unresolved) {
    syncHealthRemainingKeys(refreshedReport, [
      ...getRemainingKeys(),
      key,
    ]);
    throw new Error("修复内容已写入，但复检后这条问题仍然存在，请检查返回内容是否足够完整。");
  }
  syncHealthRemainingKeys(refreshedReport);
  appendHealthRepairLog({
    status: "done",
    findingText: finding?.text || "",
    category: finding?.category || "",
    episodeName: finding?.episodeName || "",
    action: finding?.fix?.kind || "unknown",
    detail: "已写入源节点并通过体检复检",
    nodeId: finding?.nodeId || "",
  });
  return refreshedReport;
}

export function buildFailedHealthRepairLogEntry(finding = {}, error = null) {
  return {
    status: "failed",
    findingText: finding?.text || "",
    category: finding?.category || "",
    episodeName: finding?.episodeName || "",
    action: finding?.fix?.kind || "unknown",
    detail: error?.message || String(error),
    nodeId: finding?.nodeId || "",
  };
}

export function buildBatchHealthRepairLogEntry({
  success = 0,
  failed = 0,
  remaining = 0,
  failedTexts = [],
  episodeName = "当前集",
} = {}) {
  return {
    status: failed ? "failed" : "done",
    findingText: "批量自动修复",
    category: "体检",
    episodeName,
    action: "batch",
    detail: `成功 ${success} 条，失败 ${failed} 条，剩余 ${remaining} 条${failedTexts.length ? `；失败项：${failedTexts.slice(0, 3).join("、")}${failedTexts.length > 3 ? "…" : ""}` : ""}`,
  };
}
