import { useEffect, useRef } from "react";

export function useLatestRef(value, onChange = null) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
    if (typeof onChange === "function") onChange(value);
  }, [value, onChange]);

  return ref;
}
