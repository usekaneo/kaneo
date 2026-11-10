import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        settings: { navigation: { disableChildFrameNavigation: true } },
      },
    },
  },
});
