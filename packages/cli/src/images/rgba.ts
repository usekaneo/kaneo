export type Rgb = readonly [number, number, number];

export type RgbaImage = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
};
