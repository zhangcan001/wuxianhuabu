import { useEffect, useRef } from "react";

export function useStartupProjectGuide({
  pending = false,
  setShowCompatibilityCanvas = () => {},
  setShowProjectStudio = () => {},
  setProjectMessage = () => {},
  message = "已打开项目生产工作台，按顺序从小说生成到视频。",
} = {}) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!pending || shownRef.current) return;
    shownRef.current = true;
    setShowCompatibilityCanvas(false);
    setShowProjectStudio(true);
    setProjectMessage(message);
  }, [pending, setShowCompatibilityCanvas, setShowProjectStudio, setProjectMessage, message]);
}
