export function createProjectRepository(ports = {}) {
  const parseProject = typeof ports.parseProject === "function" ? ports.parseProject : defaultParseProject;
  const serializeProject = typeof ports.serializeProject === "function" ? ports.serializeProject : defaultSerializeProject;
  const normalizeProject = typeof ports.normalizeProject === "function" ? ports.normalizeProject : (project) => project;
  return {
    async load(input = {}) {
      const content = typeof ports.load === "function" ? await ports.load(input) : input.content;
      const project = parseProject(content, normalizeProject);
      return {
        project,
        path: input.path || "",
        source: input.source || "repository",
      };
    },
    async save(project = {}, options = {}) {
      const content = serializeProject(project, options);
      if (typeof ports.save === "function") {
        const result = await ports.save({ ...options, content, project });
        return { content, ...(result || {}) };
      }
      return { content };
    },
    async cache(project = {}, options = {}) {
      const content = serializeProject(project, { ...options, compact: options.compact ?? true });
      if (typeof ports.cache === "function") {
        const result = await ports.cache({ ...options, content, project });
        return { content, ...(result || {}) };
      }
      return { content };
    },
  };
}

function defaultParseProject(content = "", normalizeProject = (project) => project) {
  if (!content) return normalizeProject({});
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return normalizeProject(parsed || {});
}

function defaultSerializeProject(project = {}, options = {}) {
  return JSON.stringify(options.projectForStorage ? options.projectForStorage(project, options) : project);
}
