import { collectBundleAssets } from "./bundle-size-report.mjs";

export const DEFAULT_BUNDLE_BUDGETS = [
  { pattern: /^dist\/assets\/index-.*\.js$/, maxKb: 720 },
  { pattern: /^dist\/assets\/three-.*\.js$/, maxKb: 780 },
  { pattern: /^dist\/assets\/index-.*\.css$/, maxKb: 160 },
];

export function checkBundleBudgets(files = collectBundleAssets(), budgets = DEFAULT_BUNDLE_BUDGETS) {
  const violations = [];
  for (const budget of budgets) {
    const matches = files.filter((file) => budget.pattern.test(file.file));
    for (const file of matches) {
      if (file.kb > budget.maxKb) {
        violations.push({
          file: file.file,
          kb: file.kb,
          maxKb: budget.maxKb,
        });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function printBundleBudgetResult(result = checkBundleBudgets()) {
  if (result.ok) {
    console.log("Bundle budgets passed.");
    return;
  }
  console.error("Bundle budgets failed:");
  for (const item of result.violations) {
    console.error(`${item.file}: ${item.kb.toFixed(2)} kB > ${item.maxKb.toFixed(2)} kB`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("bundle-budget-check.mjs")) {
  const result = checkBundleBudgets();
  printBundleBudgetResult(result);
  if (!result.ok) process.exitCode = 1;
}
