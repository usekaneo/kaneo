import {
  HOUSE,
  HOUSE_FILL,
  CHAT_CIRCLE,
  CHAT_CIRCLE_FILL,
  BOOK_OPEN,
  BOOK_OPEN_FILL,
  LIGHTBULB,
  LIGHTBULB_FILL,
  MEGAPHONE,
  MEGAPHONE_FILL,
  X,
  CARET_RIGHT,
  ARROW_RIGHT,
  MAGNIFYING_GLASS,
  PLUS,
  PENCIL_SIMPLE,
  TRAY,
  TRAY_FILL,
  FOLDER_SIMPLE,
  ARROW_UP,
  SLIDERS_HORIZONTAL,
  LINK,
  LIFEBUOY,
  LIFEBUOY_FILL,
  CAMERA,
  IMAGE,
  PAPERCLIP,
  ARROW_UP_RIGHT,
  CARET_LEFT,
  CHECK,
  ARROW_COUNTER_CLOCKWISE,
  RECTANGLE,
  CARET_DOWN,
} from "../icons/phosphor.js";

const paths = {
  home: HOUSE,
  messages: CHAT_CIRCLE,
  help: BOOK_OPEN,
  feedback: LIGHTBULB,
  updates: MEGAPHONE,
  close: X,
  back: CARET_LEFT,
  chevron: CARET_RIGHT,
  arrow: ARROW_RIGHT,
  search: MAGNIFYING_GLASS,
  plus: PLUS,
  pen: PENCIL_SIMPLE,
  inbox: TRAY,
  folder: FOLDER_SIMPLE,
  up: ARROW_UP,
  filter: SLIDERS_HORIZONTAL,
  link: LINK,
  support: LIFEBUOY,
  camera: CAMERA,
  image: IMAGE,
  attachment: PAPERCLIP,
  external: ARROW_UP_RIGHT,
  check: CHECK,
  undo: ARROW_COUNTER_CLOCKWISE,
  rectangle: RECTANGLE,
  down: CARET_DOWN,
};
const filledPaths: Partial<Record<keyof typeof paths, string>> = {
  home: HOUSE_FILL,
  messages: CHAT_CIRCLE_FILL,
  help: BOOK_OPEN_FILL,
  feedback: LIGHTBULB_FILL,
  updates: MEGAPHONE_FILL,
  inbox: TRAY_FILL,
  support: LIFEBUOY_FILL,
};

export function Icon({
  name,
  weight = "regular",
}: {
  name: keyof typeof paths;
  weight?: "regular" | "fill";
}) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 256 256"
      fill="currentColor"
    >
      <path d={(weight === "fill" && filledPaths[name]) || paths[name]} />
    </svg>
  );
}
