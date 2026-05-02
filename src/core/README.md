# Wuxianhuabu Production OS Architecture

This directory is the new commercial production kernel. Code here must stay UI-free and runtime-free:

- no React components
- no Tauri calls
- no browser storage
- no canvas DOM assumptions

The intended dependency direction is:

```text
product UI / tauri shell / legacy canvas
  -> app project command layer
  -> application use cases
    -> core production OS
      -> model / workflow / task graph / events
```

The product is treated as a production operating system, not a node editor:

```text
Workspace
  Project
    ProductionBible
    Episode
      Sequence
      Shot
      Asset
      Task
      Review
      Delivery
```

The legacy node canvas is a compatibility projection of that model. It can still edit core data
through reverse sync, but it must not own production state.

## Core Modules

- `model`: normalized commercial delivery data structures.
- `workflow`: production stage definitions, gates, blockers, and progress snapshots.
- `task-graph`: dependency-aware image, video, review, timeline, and delivery tasks.
- `events`: audit-friendly production event log and lineage reports.
- `cost`: provider/task cost forecasts, actual spend ledgers, and budget snapshots.
- `providers`: unified media source policy for API, ComfyUI, upload, and mock channels.
- `ingest`: media import plans that turn uploaded/generated media into business-addressed results.

## Migration Rules

1. New production behavior starts in `src/core`.
2. `src/main.jsx` may orchestrate UI state, but business mutations should enter through `src/app/project-command-service.js`.
3. Canvas nodes are compatibility views. Use projection/materialization instead of hand-patching node payloads.
4. Queue jobs must address business ids first: `episodeId`, `shotId`, `targetType`, `targetId`.
5. Tauri, local storage, API calls, and React state live outside the core and are passed in as ports.
6. Every commercial action should leave events that can explain lineage, cost, failures, and delivery status.
7. Any command that writes media or task results must update the commercial project before recording Production OS events, so audit and UI snapshots use the same state.
8. Media records must keep export paths and display URLs separate: paths are for delivery/cache, URLs and thumbnails are for UI previews.
