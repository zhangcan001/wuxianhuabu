export async function runProviderLiveCheck(checks = {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 5000);
  const entries = Object.entries(checks).filter(([, fn]) => typeof fn === "function");
  const results = [];
  for (const [key, fn] of entries) {
    results.push(await runOne(key, fn, timeoutMs));
  }
  return {
    ok: results.every((item) => item.ok),
    results,
    failed: results.filter((item) => !item.ok),
  };
}

async function runOne(key, fn, timeoutMs) {
  try {
    const result = await withTimeout(Promise.resolve().then(fn), timeoutMs);
    return { key, ok: result?.ok !== false, detail: result?.detail || "可用" };
  } catch (error) {
    return { key, ok: false, detail: error?.message || String(error) };
  }
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("健康检查超时")), timeoutMs);
    }),
  ]);
}
