import { useEffect, useRef } from "react";

import {
  handleTimelineRenderEvent,
} from "../realtime-feedback-helpers.js";

export function useTimelineRenderProgressListener({
  isRuntimeAvailable = () => false,
  listenTimelineRenderProgress = async () => () => {},
  activeRenderRequestRef,
  setGenerationQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  const portsRef = useRef({
    isRuntimeAvailable,
    listenTimelineRenderProgress,
    activeRenderRequestRef,
    setGenerationQueue,
    setProjectMessage,
  });

  useEffect(() => {
    portsRef.current = {
      isRuntimeAvailable,
      listenTimelineRenderProgress,
      activeRenderRequestRef,
      setGenerationQueue,
      setProjectMessage,
    };
  });

  useEffect(() => {
    const ports = portsRef.current;
    if (!ports.isRuntimeAvailable()) return undefined;
    let released = false;
    let unlisten = null;
    ports.listenTimelineRenderProgress((event) => {
      const payload = event.payload || {};
      const requestId = String(payload.requestId || "");
      if (!requestId) return;
      ports.setGenerationQueue((current) => {
        const result = handleTimelineRenderEvent({
          queue: current,
          payload,
          activeRequestId: ports.activeRenderRequestRef?.current || "",
        });
        return result.changed ? result.queue : current;
      });
      const feedback = handleTimelineRenderEvent({
        queue: [],
        payload,
        activeRequestId: ports.activeRenderRequestRef?.current || "",
      });
      if (feedback.projectMessage) {
        ports.setProjectMessage(feedback.projectMessage);
      }
    }).then((dispose) => {
      if (released) dispose();
      else unlisten = dispose;
    });
    return () => {
      released = true;
      if (unlisten) unlisten();
    };
  }, []);
}
