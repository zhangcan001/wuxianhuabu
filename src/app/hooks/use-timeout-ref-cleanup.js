import { useEffect } from "react";

export function useTimeoutRefCleanup(timeoutRef) {
  useEffect(() => () => {
    if (timeoutRef?.current) {
      globalThis.window?.clearTimeout?.(timeoutRef.current);
      timeoutRef.current = 0;
    }
  }, [timeoutRef]);
}
