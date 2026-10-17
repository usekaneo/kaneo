import { Img } from "@react-email/components";
import React from "react";
import { emailAsset } from "./assets";

void React;

const outlookHidden = { msoHide: "all" } as unknown as React.CSSProperties;

type ThemedImgProps = {
  name: string;
  width: number;
  height: number;
  alt?: string;
  style?: React.CSSProperties;
};

export function ThemedImg({
  name,
  width,
  height,
  alt = "",
  style,
}: ThemedImgProps) {
  const size = { width: String(width), height: String(height) };

  return (
    <>
      <Img
        className="k-light-img"
        src={emailAsset(name)}
        alt={alt}
        {...size}
        style={{ display: "inline-block", border: "0", ...style }}
      />
      <Img
        className="k-dark-img"
        src={emailAsset(`${name}-dm`)}
        alt={alt}
        {...size}
        style={{
          ...style,
          display: "none",
          maxHeight: "0",
          overflow: "hidden",
          ...outlookHidden,
          border: "0",
        }}
      />
    </>
  );
}
