function debounce<Args extends unknown[], R>(
  func: (...args: Args) => Promise<R> | R,
  delay: number,
) {
  let timeout: ReturnType<typeof setTimeout>;
  let pending: Args | null = null;
  const run = () => {
    if (!pending) return;
    const args = pending;
    pending = null;
    func(...args);
  };
  const debounced = (...args: Args) => {
    clearTimeout(timeout);
    pending = args;
    timeout = setTimeout(run, delay);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
    pending = null;
  };
  /** Runs a pending call now. Does nothing when no call is pending. */
  debounced.flush = () => {
    clearTimeout(timeout);
    run();
  };

  return debounced;
}

export default debounce;
