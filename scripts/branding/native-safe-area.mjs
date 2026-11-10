import { PNG } from "pngjs";

export function assertAndroidSafeArea(bytes) {
  const { width, height, data } = PNG.sync.read(bytes);
  if (width !== height) throw new Error("Android icon layer must be square");
  // Android guarantees a central 66dp safe circle inside the 108dp layer.
  const radiusSquared = ((width * 33) / 108) ** 2;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (
        data[(y * width + x) * 4 + 3] &&
        (x + 0.5 - width / 2) ** 2 + (y + 0.5 - height / 2) ** 2 > radiusSquared
      )
        throw new Error(
          "Android artwork extends outside the adaptive icon safe circle",
        );
}
