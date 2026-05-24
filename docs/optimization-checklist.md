# 优化迁移清单

这份清单对应本轮 21 项优化，目标是把主入口瘦身、兼容画布隔离、媒体字段边界、发布检查、端到端冒烟、生产调度和成熟桌面分发固化为可执行护栏。

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
13. `release:build` 必须先跑 `test:release`，再执行 Tauri 正式打包。
14. `release-safety-check.mjs` 检查 `package.json`、`tauri.conf.json` 和 `Cargo.toml` 版本一致。
15. NSIS 安装包固定使用应用图标、当前用户安装、中文语言和开始菜单目录。
16. `test:desktop-smoke` 检查 release exe、NSIS 安装包和安装器配置，后续自动更新、代码签名应继续进入 release safety。

## 21 项优化推进看板

1. 首屏 JS 预算继续收紧，主入口职责继续外移。
2. CSS 预算继续收紧，旧画布和生产工作台样式逐步分区。
3. Three.js 和全景能力保持按需加载。
4. 镜头表、资产库、任务队列和时间线引入大项目虚拟化。
5. 画布性能模式继续覆盖阴影、连线、缩放摘要和小地图刷新。
6. 生产工作台作为默认主流程，旧无限画布保持高级兼容入口。
7. 图片、视频、配音、导出和修复任务继续收敛到统一任务队列。
8. 镜头表升级为可批量生图、生视频、改参数和重试的生产调度表。
9. 项目资源中心追踪素材引用、缺失素材和统一重命名。
10. 角色、场景、道具资产卡通过 token 约束镜头一致性。
11. 任务失败需要展示服务、参数摘要、返回错误和推荐动作。
12. 自动保存、启动恢复、保存失败提示和最近项目列表继续产品化。
13. 项目健康检查的一键修复能力继续前移到生产工作台。
14. API 配置检测覆盖文本、图片、视频、ComfyUI 和本地服务。
15. 安装包体验包含图标、开始菜单、卸载信息和安装后启动策略。
16. 自动更新作为正式分发前置能力规划。
17. 正式分发前接入代码签名，降低 Windows 安全提示。
18. 开发版、测试版和正式版需要在标题或版本信息中可区分。
19. `src/main.jsx` 继续瘦身，新增业务优先进入 `src/app` 或 `src/domain`。
20. `test:release` 和 `release:build` 是发布前固定入口。
21. 桌面端 smoke test 应覆盖启动、打开项目、保存项目和小样导出。

## 发布前命令

```bash
npm test
npm run test:release
npm run test:e2e:studio:preview
npm run release:build
npm run test:desktop-smoke
```

`test:e2e:studio:preview` 依赖本机 Chrome/Playwright 可启动；如果 CI 环境没有浏览器，应保留 `studio-smoke.mjs` 并在有浏览器的流水线执行。
