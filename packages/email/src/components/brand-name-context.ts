import { brandText } from "@kaneo/branding";
import { createContext } from "react";

export const BrandNameContext = createContext(brandText("Kaneo"));
