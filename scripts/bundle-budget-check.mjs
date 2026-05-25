import { collectBundleAssets } from "./bundle-size-report.mjs";

export const DEFAULT_BUNDLE_BUDGETS = [
  { pattern: /^dist\/assets\/index-.*\.js$/, maxKb: 680, required: true },
  { pattern: /^dist\/assets\/three-.*\.js$/, maxKb: 780 },
  { pattern: /^dist\/assets\/index-.*\.css$/, maxKb: 145, required: true },
  { pattern: /^dist\/assets\/project-studio-.*\.js$/, maxKb: 110, required: true },
  { pattern: /^dist\/assets\/panel-dashboard-.*\.js$/, maxKb: 80, required: true },
  { pattern: /^dist\/assets\/panel-export-center-.*\.js$/, maxKb: 50, required: true },
  { pattern: /^dist\/assets\/panel-timeline-.*\.js$/, maxKb: 45, required: true },
  { pattern: /^dist\/assets\/panel-simple-workflow-.*\.js$/, maxKb: 25, required: true },
  { pattern: /^dist\/assets\/panel-generation-queue-.*\.js$/, maxKb: 25, required: true },
  { pattern: /^dist\/assets\/panel-ops-.*\.js$/, maxKb: 30, required: true },
];

export function checkBundleBudgets(files = collectBundleAssets(), budgets = DEFAULT_BUNDLE_BUDGETS) {
  const violations = [];
  for (const budget of budgets) {
    const matches = files.filter((file) => budget.pattern.test(file.file));
    if (budget.required && matches.length === 0) {
      violations.push({
        file: String(budget.pattern),
        kb: 0,
        maxKb: budget.maxKb,
        missing: true,
      });
      continue;
    }
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
    if (item.missing) {
      console.error(`${item.file}: required bundle was not emitted`);
      continue;
    }
    console.error(`${item.file}: ${item.kb.toFixed(2)} kB > ${item.maxKb.toFixed(2)} kB`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("bundle-budget-check.mjs")) {
  const result = checkBundleBudgets();
  printBundleBudgetResult(result);
  if (!result.ok) process.exitCode = 1;
}
