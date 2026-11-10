import type { Preview } from "@storybook/react-vite";
import { INITIAL_VIEWPORTS } from "storybook/viewport";
import "../stories/stories.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: { options: INITIAL_VIEWPORTS },
  },
};

export default preview;
