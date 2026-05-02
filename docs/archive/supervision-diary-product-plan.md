# 自动生成个人监理日记项目方案

## 项目目标

根据固定 Word 模板和每日现场输入，自动生成格式统一、语言规范、可归档的个人监理日记。

## 第一版功能

1. 项目配置
   - 日记填写人
   - 默认工程信息
   - 常用施工单位、专业、楼栋、区域

2. 每日录入
   - 日期与天气
   - 现场施工情况
   - 人员动态
   - 机械使用情况
   - 巡视/检查情况
   - 材料验收/见证取样
   - 验收、旁站、会议、内业工作
   - 存在问题及处理情况
   - 其它事项

3. 自动生成
   - 将简短输入扩写为正式日志段落
   - 自动编号
   - 默认填充“无。”
   - 自动生成星期
   - 按模板导出 `.docx`

4. 历史管理
   - 按日期保存原始输入和生成结果
   - 支持复制前一天内容作为今天草稿
   - 支持重新生成和重新导出

## 推荐技术架构

因为最终需要交付 `.exe` 给其他 Windows 电脑使用，第一版建议直接按桌面应用设计，而不是单纯做网页服务。

推荐方案：

```text
桌面壳：Electron
界面：React + Vite
本地数据：SQLite
Word 生成：docxtemplater / pizzip
打包：electron-builder
AI 生成：预留 provider 接口，后续可接 OpenAI 或其它大模型
```

选择 Electron 的原因：

- 打包成 `.exe` 比较成熟。
- 可以内置前端页面、本地数据库、模板文件和导出功能。
- 用户在其他电脑上双击安装或直接运行即可使用。
- 后续如果需要上传图片、选择 Word 导出路径、管理历史日志，桌面权限更方便。

备选方案：

```text
Python + PySide6 + python-docx + SQLite + PyInstaller
```

这个方案体积可能更小，但界面开发体验和后续扩展性不如 Electron。考虑到这个项目需要比较好用的录入界面、历史列表、预览和导出，建议优先使用 Electron。

## 桌面版运行方式

开发阶段：

```text
npm run dev
```

打包阶段：

```text
npm run build
npm run dist
```

最终交付物：

```text
dist/
├─ 监理日记生成器 Setup.exe
└─ win-unpacked/
```

其他电脑使用方式：

1. 安装或复制 exe。
2. 第一次启动时自动创建本地数据库。
3. 模板文件随程序内置，也支持以后在设置里替换模板。
4. 日志数据保存在用户电脑本地。

## 本地数据位置

建议把用户数据保存到 Windows 应用数据目录，避免程序升级时覆盖数据。

```text
C:\Users\用户名\AppData\Roaming\监理日记生成器\
├─ app.db
├─ exports/
└─ templates/
```

## 离线能力

第一版必须支持完全离线使用：

- 填写日志
- 保存历史
- 生成 Word
- 导出 Word

AI 扩写作为增强功能处理。没有网络或没有配置 API Key 时，程序仍然可以用模板和常用语规则生成日志。

## Word 生成策略

优先保留原始 Word 模板样式：

1. 将现有 `.docx` 改造成带占位符的模板。
2. 程序把每日结构化数据填入占位符。
3. 导出新的 `.docx`。

示例占位符：

```text
{{dateText}}
{{weekday}}
{{weatherMorning}}
{{weatherAfternoon}}
{{constructionStatus}}
{{inspectionWork}}
{{writer}}
```

现场图片后续通过图片占位符插入。

```text
Electron 主进程
├─ 文件选择/保存
├─ SQLite 数据库
├─ Word 模板渲染
├─ 应用配置
└─ AI provider，可选

React 渲染进程
├─ 今日录入
├─ 生成预览
├─ 历史日志
├─ 模板设置
└─ 导出操作
```

## 目录规划

```text
new_project
├─ templates/
│  └─ 个人监理日记模板.docx
├─ docs/
│  ├─ template-analysis.md
│  └─ product-plan.md
├─ electron/
│  ├─ main/
│  └─ preload/
├─ src/
│  ├─ pages/
│  ├─ components/
│  ├─ services/
│  └─ styles/
├─ resources/
│  └─ templates/
└─ dist/
```

## 后续开发顺序

1. 初始化 Electron + React 项目。
2. 建立日志数据模型和 SQLite 表。
3. 做每日录入页面。
4. 做模板字段映射和 Word 导出。
5. 增加历史日志列表。
6. 接入 AI 扩写与润色。
7. 增加现场图片上传和插入 Word。
