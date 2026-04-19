export function useApi(serviceFn) {
  const run = async (...args) => {
    return serviceFn(...args);
  };

  return { run };
}
