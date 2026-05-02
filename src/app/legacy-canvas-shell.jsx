import React from "react";
import {
  previewEdgePath,
  worldToScreen,
} from "../canvas-viewport-helpers.js";
import { CanvasNode } from "./canvas-node.jsx";

export function LegacyCanvasOverlay({
  show,
  selectionBox,
  edgeLayerRef,
  visibleEdges = [],
  nodeById = new Map(),
  view,
  selectedEdgeId,
  selectEdge,
  openEdgeMenu,
  connectionDrag,
  worldRef,
  renderNodes = [],
  guardNode: GuardNode,
  nodeRuntime,
  nodeMenuItems = [],
  drag,
  highlightedNodeId,
  nodes = [],
  selectedNodeIds = [],
  marqueeMode,
  shiftPressedRef,
  updateNode,
  selectNode,
  setDrag,
  setResize,
  addNode,
  connectFromLast,
  createOutputNear,
  createManyOutputs,
  deleteNode,
  duplicateNode,
  startConnection,
  finishConnection,
  pushHistory,
  settings,
  textApiSettings,
  patchTextApiSettings,
  openSettings,
  stylePresetCenter,
  onOpenStylePresetCenter,
  viewRef,
  assetIndex,
  openPromptPreview,
  addGenerationJobs,
  resourceIndex,
  importShotsToTimeline,
  syncPipelineToLinkedNodes,
  sendImageToLinkedNode,
  appendShotsToNearestShotList,
  applyResultToNearestShot,
  handleResultShotAction,
  createPromptNodeFromAsset,
  locateResultForShot,
  visibleNodes = [],
  activeEpisodeName,
  menu,
  nodeMenu,
  edgeMenu,
  openNodeMenu,
  sendResultToSplit,
  deleteEdge,
}) {
  if (!show) return null;

  return (
    <>
      <div className="canvas-bg" />
      {selectionBox && <SelectionBox box={selectionBox} />}
      <svg className="edge-layer" ref={edgeLayerRef}>
        {visibleEdges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          const a = worldToScreen(source.x + source.width, source.y + source.height / 2, view);
          const b = worldToScreen(target.x, target.y + target.height / 2, view);
          const mid = Math.max(70, Math.abs(b.x - a.x) / 2);
          return (
            <path
              key={edge.id}
              data-edge-id={edge.id}
              className={`edge ${selectedEdgeId === edge.id ? "selected" : ""}`}
              d={`M ${a.x} ${a.y} C ${a.x + mid} ${a.y}, ${b.x - mid} ${b.y}, ${b.x} ${b.y}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                selectEdge?.(edge.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openEdgeMenu?.(edge.id, event);
              }}
            />
          );
        })}
        {connectionDrag && (
          <path
            className="edge connection-preview"
            d={previewEdgePath(connectionDrag.from, connectionDrag.to)}
          />
        )}
      </svg>
      <section ref={worldRef} className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        {renderNodes.map((node) => {
          const label = node.title || nodeMenuItems.find((item) => item.type === node.type)?.label || "节点";
          return (
            <GuardNode key={node.id} label={label} nodeId={node.id}>
              <CanvasNode
                node={node}
                isDragging={drag?.id === node.id}
                highlighted={highlightedNodeId === node.id}
                allNodes={nodes}
                selectedNodeIds={selectedNodeIds}
                marqueeMode={marqueeMode}
                shiftPressedRef={shiftPressedRef}
                updateNode={updateNode}
                selectNode={selectNode}
                setDrag={setDrag}
                setResize={setResize}
                addNode={addNode}
                connectFromLast={connectFromLast}
                createOutputNear={createOutputNear}
                createManyOutputs={createManyOutputs}
                deleteNode={deleteNode}
                duplicateNode={duplicateNode}
                openNodeMenu={openNodeMenu}
                startConnection={startConnection}
                finishConnection={finishConnection}
                pushHistory={pushHistory}
                settings={settings}
                textApiSettings={textApiSettings}
                patchTextApiSettings={patchTextApiSettings}
                openSettings={openSettings}
                stylePresetCenter={stylePresetCenter}
                onOpenStylePresetCenter={onOpenStylePresetCenter}
                viewRef={viewRef}
                assetIndex={assetIndex}
                openPromptPreview={openPromptPreview}
                addGenerationJobs={addGenerationJobs}
                resourceIndex={resourceIndex}
                importShotsToTimeline={importShotsToTimeline}
                syncPipelineToLinkedNodes={syncPipelineToLinkedNodes}
                sendImageToLinkedNode={sendImageToLinkedNode}
                appendShotsToNearestShotList={appendShotsToNearestShotList}
                applyResultToNearestShot={applyResultToNearestShot}
                handleResultShotAction={handleResultShotAction}
                createPromptNodeFromAsset={createPromptNodeFromAsset}
                locateResultForShot={locateResultForShot}
                runtime={nodeRuntime}
              />
            </GuardNode>
          );
        })}
      </section>
      {visibleNodes.length === 0 && (
        <div className="empty-hint">
          <div>双击鼠标添加节点</div>
          <small>{activeEpisodeName || "当前集"} · Double-click to add a node</small>
        </div>
      )}
      {menu && (
        <div className="add-menu" style={{ left: menu.screenX, top: menu.screenY }}>
          {nodeMenuItems.map((item) => (
            <button key={item.type} onClick={() => addNode(item.type, menu.world)}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
      {nodeMenu && (
        <div className="context-menu" style={{ left: nodeMenu.screenX, top: nodeMenu.screenY }}>
          <button onClick={() => duplicateNode(nodeMenu.nodeId)}>复制节点</button>
          {nodes.find((node) => node.id === nodeMenu.nodeId)?.type === "result" && (
            <button onClick={() => sendResultToSplit(nodeMenu.nodeId)}>送入分镜拆分</button>
          )}
          <button className="danger-item" onClick={() => deleteNode(nodeMenu.nodeId)}>删除节点</button>
        </div>
      )}
      {edgeMenu && (
        <div className="context-menu" style={{ left: edgeMenu.screenX, top: edgeMenu.screenY }}>
          <button className="danger-item" onClick={() => deleteEdge(edgeMenu.edgeId)}>删除连线</button>
        </div>
      )}
    </>
  );
}

function SelectionBox({ box }) {
  return (
    <div
      style={{
        position: "fixed",
        left: Math.min(box.sx, box.cx),
        top: Math.min(box.sy, box.cy),
        width: Math.abs(box.cx - box.sx),
        height: Math.abs(box.cy - box.sy),
        border: "1px solid rgba(118, 203, 255, 0.95)",
        background: "rgba(66, 173, 255, 0.12)",
        boxShadow: "0 0 0 1px rgba(66, 173, 255, 0.18) inset",
        pointerEvents: "none",
        zIndex: 12,
      }}
    />
  );
}
