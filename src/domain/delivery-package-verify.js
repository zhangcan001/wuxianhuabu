export function verifyDeliveryPackage(packageContent = {}, fileIndex = {}) {
  const manifest = packageContent.manifest || packageContent.deliveryPackage?.manifest || {};
  const refs = collectRefs(manifest);
  const missing = refs.filter((ref) => !fileIndex[ref]);
  const checksumOk = !manifest.checksum || manifest.checksum === packageContent.checksum || packageContent.skipChecksum === true;
  return {
    ok: missing.length === 0 && checksumOk && Boolean(manifest),
    references: refs.length,
    missing,
    checksumOk,
    reloadable: Boolean(packageContent.project || packageContent.businessProject),
  };
}

function collectRefs(value, refs = []) {
  if (!value || typeof value !== "object") return refs;
  Object.entries(value).forEach(([key, item]) => {
    if (/path|file|media/i.test(key) && typeof item === "string" && item.trim()) refs.push(item);
    else if (Array.isArray(item)) item.forEach((child) => collectRefs(child, refs));
    else if (item && typeof item === "object") collectRefs(item, refs);
  });
  return [...new Set(refs)];
}
