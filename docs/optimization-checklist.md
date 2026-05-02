# 优化迁移清单

这份清单对应本轮 12 项优化，目标是把主入口瘦身、兼容画布隔离、媒体字段边界、发布检查和端到端冒烟固化为可执行护栏。

## 已落地护栏

1. `src/main.jsx` 继续作为组合层，职责预算由 `tests/architecture-boundaries.test.mjs` 约束。
2. 媒体队列入口收敛到 `src/app/production-media-queue-actions.js`。
3. `npm run bundle:check` 检查主入口 JS、CSS、生产工作台、工作区面板和兼容画布拆分 chunk。
4. `npm run test:e2e:studio:preview` 会固定端口启动 preview 并运行 `studio-smoke.mjs`。
5. 兼容画布保留在 `src/app/legacy-canvas-*.jsx`，并通过 `LazyLegacyCanvasOverlay` 懒加载。
6. 媒体字段边界由 `auditMediaReferenceBoundaries` 审计：URL 字段用于展示，Path 字段用于本地文件。
7. 生产链路 fixture 保留在 `src/domain/mini-production-e2e.js`。
8. CSS 体积进入 bundle budget，避免首屏样式继续膨胀。
9. 产品面板继续通过 `src/product/studio/*-panel.jsx` 分离。
10. Provider 前置校验保留在 `src/app/production-preflight.js` 和相关 domain 测试中。
11. 本地路径与预览 URL 的边界由媒体选择器、媒体索引和新增审计测试覆盖。
12. `FRONTEND_OPTIMIZATION_CHECKLIST` 是可测试迁移看板，新增优化项应同步更新测试。

## 发布前命令

```bash
npm test
npm run test:release
npm run test:e2e:studio:preview
```

`test:e2e:studio:preview` 依赖本机 Chrome/Playwright 可启动；如果 CI 环境没有浏览器，应保留 `studio-smoke.mjs` 并在有浏览器的流水线执行。
