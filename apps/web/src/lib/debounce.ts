function debounce<Args extends unknown[], R>(
  func: (...args: Args) => Promise<R> | R,
  delay: number,
) {
  let timeout: ReturnType<typeof setTimeout>;
  const debounced = (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };

  debounced.cancel = () => clearTimeout(timeout);

  return debounced;
}

export default debounce;
