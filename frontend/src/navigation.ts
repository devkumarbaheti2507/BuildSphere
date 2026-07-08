export const navigate = (path: string): void => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const projectIdFromPath = (path: string): string | undefined =>
  /^\/projects\/([^/]+)$/.exec(path)?.[1];
