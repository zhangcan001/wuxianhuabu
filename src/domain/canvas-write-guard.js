const PRODUCTION_FIELDS = new Set([
  "shots",
  "assets",
  "timeline",
  "imageResultUrl",
  "videoResultUrl",
  "imagePath",
  "videoPath",
  "reviewStatus",
]);

export function buildCanvasWriteGuard(change = {}) {
  const fields = collectFieldNames(change.patch || change.data || change);
  const productionFields = fields.filter((field) => PRODUCTION_FIELDS.has(field));
  return {
    ok: productionFields.length === 0 || change.viaCommandService === true,
    productionFields,
    warning: productionFields.length && change.viaCommandService !== true
      ? "这些生产字段需要通过主工作台命令保存，避免工程数据不同步。"
      : "",
  };
}

function collectFieldNames(value, result = []) {
  if (!value || typeof value !== "object") return result;
  Object.keys(value).forEach((key) => {
    result.push(key);
    collectFieldNames(value[key], result);
  });
  return result;
}
