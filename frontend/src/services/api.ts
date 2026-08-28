const simulateDelay = async (ms = 200) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const api = {
  get: async <T>(payload: T): Promise<T> => {
    await simulateDelay();
    return payload;
  },
  post: async <T>(payload: T): Promise<T> => {
    await simulateDelay();
    return payload;
  },
  patch: async <T>(payload: T): Promise<T> => {
    await simulateDelay();
    return payload;
  },
};
