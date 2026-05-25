import { useEffect } from "react";

import {
  projectStoreReducer,
} from "../project-store.js";

export function useProjectStoreHydration({
  legacyCommercialProject,
  projectStoreState,
  projectStoreStateRef,
  setProjectStoreState = () => {},
} = {}) {
  useEffect(() => {
    setProjectStoreState((current) => {
      const next = projectStoreReducer(current, {
        type: "hydrate",
        source: "legacy",
        project: legacyCommercialProject,
      });
      if (projectStoreStateRef) projectStoreStateRef.current = next;
      return next;
    });
  }, [legacyCommercialProject, projectStoreStateRef, setProjectStoreState]);

  useEffect(() => {
    if (projectStoreStateRef) projectStoreStateRef.current = projectStoreState;
  }, [projectStoreState, projectStoreStateRef]);
}
