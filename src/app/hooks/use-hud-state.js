import { useCallback, useState } from "react";

export function useHudState({ initialCollapsed = false, initialDock = "bottom", initialVisible = false } = {}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [dock, setDock] = useState(initialDock);
  const [visible, setVisible] = useState(initialVisible);

  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);
  const toggleDock = useCallback(() => setDock((value) => (value === "bottom" ? "top" : "bottom")), []);
  const toggleVisible = useCallback(() => setVisible((value) => !value), []);
  const close = useCallback(() => setVisible(false), []);

  return {
    collapsed,
    dock,
    visible,
    setCollapsed,
    setDock,
    setVisible,
    toggleCollapsed,
    toggleDock,
    toggleVisible,
    close,
  };
}
