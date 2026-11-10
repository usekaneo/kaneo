/** User-invoked capture only; no audio and no track survives success, failure, or cancellation. */
export async function captureScreenshot(
  signal: AbortSignal,
): Promise<File | null> {
  if (!navigator.mediaDevices?.getDisplayMedia)
    throw new Error("Screen capture is unavailable. Attach an image instead.");
  if (signal.aborted) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError")
      return null;
    throw new Error(
      "Could not capture the screen. Attach an image or try again.",
    );
  }
  const stop = () => stream.getTracks().forEach((track) => track.stop());
  const video = document.createElement("video");
  signal.addEventListener("abort", stop, { once: true });
  try {
    if (signal.aborted) return null;
    video.muted = true;
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onerror = null;
        signal.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve();
      };
      const abort = () => finish(new DOMException("Cancelled", "AbortError"));
      const timer = setTimeout(
        () => finish(new Error("Screen capture timed out. Please try again.")),
        10000,
      );
      video.onloadeddata = () => finish();
      video.onerror = () =>
        finish(new Error("Could not read the captured screen."));
      signal.addEventListener("abort", abort, { once: true });
      void video
        .play()
        .catch(() => finish(new Error("Could not read the captured screen.")));
    });
    if (signal.aborted || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      2048 / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Screen capture is unavailable. Attach an image instead.",
      );
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (signal.aborted) return null;
    if (!blob) throw new Error("Could not save the captured image.");
    return new File([blob], "screenshot.png", { type: "image/png" });
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
    video.srcObject = null;
  }
}
