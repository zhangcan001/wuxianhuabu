import { useEffect } from "react";

export function useCanvasKeyboardShortcuts({
  nodes = [],
  selectedEdgeId = "",
  shiftPressedRef,
  undo = () => {},
  redo = () => {},
  pushHistory = () => {},
  setNodes = () => {},
  setEdges = () => {},
  deleteEdge = () => {},
  duplicateNodes = () => {},
  eventTarget,
} = {}) {
  useEffect(() => {
    const target = eventTarget || globalThis.window;
    if (!target?.addEventListener) return;

    function onKeyDown(event) {
      if (event.key === "Shift" && shiftPressedRef) shiftPressedRef.current = true;
      if (isEditableEventTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")) {
        event.preventDefault();
        redo();
        return;
      }
      const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id);
      if (!selectedIds.length && !selectedEdgeId) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selectedIds.length) {
          pushHistory();
          setNodes((current) => current.filter((node) => !selectedIds.includes(node.id)));
          setEdges((current) => current.filter((edge) => !selectedIds.includes(edge.source) && !selectedIds.includes(edge.target)));
        } else {
          deleteEdge(selectedEdgeId);
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateNodes(selectedIds);
      }
    }

    function onKeyUp(event) {
      if (event.key === "Shift" && shiftPressedRef) shiftPressedRef.current = false;
    }

    function onWindowBlur() {
      if (shiftPressedRef) shiftPressedRef.current = false;
    }

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onWindowBlur);
    return () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onWindowBlur);
    };
  }, [
    deleteEdge,
    duplicateNodes,
    eventTarget,
    nodes,
    pushHistory,
    redo,
    selectedEdgeId,
    setEdges,
    setNodes,
    shiftPressedRef,
    undo,
  ]);
}

function isEditableEventTarget(target) {
  const InputElement = globalThis.HTMLInputElement;
  const TextAreaElement = globalThis.HTMLTextAreaElement;
  const SelectElement = globalThis.HTMLSelectElement;
  return (InputElement && target instanceof InputElement)
    || (TextAreaElement && target instanceof TextAreaElement)
    || (SelectElement && target instanceof SelectElement);
}
