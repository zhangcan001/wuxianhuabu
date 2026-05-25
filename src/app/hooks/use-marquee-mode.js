import { useCallback, useState } from "react";

export function useMarqueeMode(initial = false) {
  const [marqueeMode, setMarqueeMode] = useState(initial);
  const toggleMarqueeMode = useCallback(() => setMarqueeMode((value) => !value), []);
  return { marqueeMode, setMarqueeMode, toggleMarqueeMode };
}
