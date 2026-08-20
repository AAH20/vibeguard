// Real false-positive class found by scanning a large real codebase
// (continue) before this fix: serviceContainer.get() and api.get() are a
// DI container and an HTTP client, not ORM calls, and must not be flagged.
export async function resolveTool(serviceContainer, id) {
  for (const key of ['a', 'b', 'c']) {
    await serviceContainer.get(key);
  }
}

export async function fetchComments(api, ids) {
  return Promise.all(ids.map(async (id) => await api.get(`/comments/${id}`)));
}
