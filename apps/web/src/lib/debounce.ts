function debounce<Args extends unknown[], R>(
  func: (...args: Args) => Promise<R> | R,
  delay: number,
) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

export default debounce;
