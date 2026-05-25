# 火山AI漫剧架构方案

## 目标

当前产品的核心生产链应收敛为：

```text
小说/剧情梗概 -> 文本提示词系统 -> 图片生成系统 -> 视频生成系统
```

新手用户默认只看到这条主流程；高级用户仍可进入节点画布、Prompt 工厂、资源中心、队列、时间线和导出中心。

## 系统拆分

### 1. 文本提示词系统

职责：

- 小说解析
- 剧本生成
- 角色、场景、道具资产卡生成
- 镜头表生成
- 图片提示词和视频提示词生成

输入：

- 小说正文、剧情梗概或已有剧本
- 文本模型配置
- 项目风格和集数信息

输出：

- `script`
- `assets`
- `shots`
- `imagePrompt`
- `videoPrompt`

边界：

- 不直接生成图片
- 不直接生成视频
- 不直接写 UI 状态，只返回结构化结果或事件

### 2. 图片生成系统

职责：

- 接收资产或镜头图片提示词
- 调用图片 API、ComfyUI 或本地模拟
- 生成图片资源
- 写回资源引用、失败原因、生成参数和版本信息

输入：

- `asset.imagePrompt`
- `shot.imagePrompt`
- 参考图、风格、模型参数

输出：

- 图片资源记录
- 图片任务状态
- 图片生成版本

边界：

- 不解析小说
- 不生成视频
- 不直接推进时间线，只发出图片完成事件

### 3. 视频生成系统

职责：

- 接收图片资源和视频提示词
- 调用视频模型、ComfyUI workflow 或后续视频服务
- 生成视频片段
- 写回镜头和时间线素材引用

输入：

- `shot.videoPrompt`
- `shot.imageResourceId`
- 时长、镜头运动、版式、模型参数

输出：

- 视频资源记录
- 视频任务状态
- 视频生成版本

边界：

- 不解析小说
- 不生成图片
- 不直接修改文本提示词

### 4. 编排与数据交换系统

职责：

- 管理跨系统命令
- 管理事件流
- 管理任务队列
- 管理镜头状态机
- 管理资源索引
- 处理失败重试和结果回写
- 给 UI 提供统一进度快照

它是唯一允许协调三个生产系统的中枢。

## 依赖方向

推荐依赖方向：

```text
UI -> Project Command Layer -> Orchestrator / Production App Service
                         -> Text Pipeline
                         -> Image Pipeline
                         -> Video Pipeline
                         -> Resource Store
                         -> Event Bus
```

禁止方向：

```text
Text Pipeline -> Image Pipeline
Image Pipeline -> Video Pipeline
Video Pipeline -> Text Pipeline
```

子系统之间不互相直接调用，只通过编排系统交换命令和事件。

## 前端责任边界

`src/main.jsx` 是工作区组合层，只负责持有顶层状态、接线 app actions、渲染当前工作区壳。新功能不应直接把业务流程塞回主入口。

当前约定：

- `src/app/*-actions.js`：可测试的应用动作，负责把 UI 请求转换为项目命令、队列提交或运行时端口调用。
- `src/app/*-runtime.js`：运行时适配和动态加载，例如全景/Three.js 能力。
- `src/app/hooks/use-*.js`：顶层状态副作用和事件监听（React Hooks 集中目录）。
- `src/app/legacy-canvas-*.jsx`：兼容画布 UI 边界，只在用户打开旧画布时加载。
- `src/app/canvas-node.jsx`：兼容画布节点壳，节点内部仍通过懒加载拆到 basic/heavy/canvas-heavy 节点文件。
- `src/product/studio/*`：生产工作台 UI。它可以调用 app actions，但不应直接依赖旧画布 adapter。
- `src/domain/*` 与 `src/core/*`：纯业务规则，不能依赖 React、Tauri、DOM 或浏览器存储。

主入口预算：

- `src/main.jsx` 当前必须低于架构测试中的行数预算。
- 每次把职责移出主入口后，都应同步收紧预算。
- 新增生产链路能力时，优先落在 `src/app` action/hook/runtime 或 `src/domain`，再由主入口接线。

兼容画布策略：

- 生产工作台是默认入口，兼容画布只用于迁移、高级检查和旧节点数据排查。
- `LegacyCanvasOverlay` 必须保持懒加载，避免旧画布节点树进入首屏主 chunk。
- 新的生产功能不应依赖兼容画布节点作为唯一数据来源。

## 命令

命令表示“请求系统做一件事”。

```text
text.generateProjectDraft
text.generateAssetsAndShots
image.queueShotImages
image.queueAssetImages
video.queueShotVideos
orchestrator.runTextOnly
orchestrator.runFullProduction
```

## 事件

事件表示“系统已经发生了一件事”。

```text
text.completed
asset.updated
shot.updated
image.task.created
image.completed
video.task.created
video.completed
task.failed
resource.created
```

UI 只订阅事件和进度快照，不直接判断复杂业务。

## 数据主权

项目生产状态只能以商业模型为唯一事实源：

```text
Project -> Episode -> Asset / Shot / Task / Timeline / Delivery
```

`nodes / edges / node.data` 是兼容投影，不再拥有生产状态。旧画布可以作为高级编辑器存在，但所有会改变生产结果的动作必须先写入商业模型，再由投影层同步到画布。

当前应用层写入口：

```text
src/app/project-command-service.js
```

职责：

- 接收文本生产包并写入 `script / assets / shots`
- 接收上传、生成、导入等业务结果
- 通过 `projectStoreReducer` 写入商业模型
- 基于最新商业模型生成旧画布 patch
- 基于最新商业模型记录 Production OS 事件
- 保证 UI、画布、审计链路和全局状态看到同一份结果

禁止新增功能直接在 UI 中同时 patch `businessProject`、`nodes`、`timeline` 和 `productionEvents`。如果一个动作会改变生产状态，应先扩展 Project Command Layer。

媒体字段必须区分：

- `imagePath / videoPath`：本地缓存路径，给导出、工程归档和资源追踪使用
- `imageUrl / videoUrl / imageThumbnailUrl`：界面可显示地址，给预览、资产库和镜头表使用
- `imageResultUrl / videoResultUrl`：生产结果主引用，可优先保留可交付路径

UI 预览不得直接依赖本地文件路径字段。

资产图片允许保留多候选：

- `imageItems`：候选图列表，包含 `imageUrl / imagePath / thumbnailUrl / primary / discarded / locked`
- `imageUrl / imagePath`：当前主图，仍然是资产卡和下游引用的默认字段
- 候选图的“设为主图 / 废弃”必须通过 `projectStoreReducer` 的业务动作写回，不能只改 UI 本地状态

工作台页面读取策略：

- 镜头表、资产库、媒体生产、审片和交付优先读取 `businessProject.activeEpisode`
- 时间线页优先读取 `activeEpisode.timeline.clips`，没有时间线片段时才按镜头视频状态兼容展示
- 队列状态可以内嵌展示，但重试仍走队列状态机，不在表格行里手写状态

## 新手模式

新手模式默认运行：

```text
orchestrator.runTextOnly
```

停止点：

- 剧本已生成
- 资产已输出
- 镜头表已输出
- 图片提示词和视频提示词已写入镜头表

新手模式不会自动触发：

- 图片生成任务
- 视频生成任务
- 时间线导出任务

如果用户明确点击“生成图片”或“继续生成视频”，才进入后续系统。

## 高级模式

高级模式可以运行：

```text
orchestrator.runFullProduction
```

它允许按顺序推进：

```text
文本 -> 图片 -> 视频 -> 时间线 -> 导出
```

高级模式仍应通过同一套命令和事件执行，避免和新手模式分裂成两套逻辑。

## 迁移计划

### 阶段 1：建立契约

- 新建 `src/domain`
- 定义命令、事件、状态机和进度快照
- 为这些纯逻辑增加测试

### 阶段 2：迁移文本生产

- 把小说到资产和镜头表的逻辑迁入 `text-pipeline`
- UI 只调用 `orchestrator.runTextOnly`
- 新手模式停止在文本交付结果

### 阶段 3：迁移图片生产

- 把图片队列任务创建迁入 `image-pipeline`
- 图片完成只发事件，由编排系统回写镜头和资源

### 阶段 4：迁移视频生产

- 把视频任务创建和结果回写迁入 `video-pipeline`
- 时间线只读取资源和镜头状态，不直接驱动模型调用

### 阶段 5：瘦身主应用

- `main.jsx` 只保留 UI 状态、面板开关和 canvas 交互
- 业务流程进入 domain 层
