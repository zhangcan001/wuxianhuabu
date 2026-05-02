import { useEffect, useState } from "react";

import {
  persistProjectPath,
} from "../project-file-helpers.js";

export function useProjectPathState(storage, storageKey) {
  const [currentProjectPath, setCurrentProjectPath] = useState(() => storage?.getItem?.(storageKey) || "");

  useEffect(() => {
    persistProjectPath(storage, storageKey, currentProjectPath);
  }, [currentProjectPath, storage, storageKey]);

  return [currentProjectPath, setCurrentProjectPath];
}
