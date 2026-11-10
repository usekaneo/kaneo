import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { WidgetPlayground } from "./WidgetPlayground.js";

const meta = {
  title: "Widget/SDK",
  component: WidgetPlayground,
  // Init-only controls require a fresh owner; identity changes stay inside the component.
  render: (args) => <WidgetPlayground key={JSON.stringify(args)} {...args} />,
  args: {
    placement: "right",
    launcher: true,
    initializeDelay: 0,
    shouldInitialize: true,
  },
  argTypes: {
    placement: { control: "inline-radio", options: ["left", "right"] },
    initializeDelay: { control: { type: "number", min: 0, step: 250 } },
  },
} satisfies Meta<typeof WidgetPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByText("Ready", {}, { timeout: 5000 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Ada" }));
    await expect(await canvas.findByText("Ada Lovelace")).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Anonymous" }));
    await expect(
      await canvas.findByText("Anonymous", { selector: "dd" }),
    ).toBeVisible();
  },
};
export const LeftAligned: Story = { args: { placement: "left" } };
export const WithoutLauncher: Story = { args: { launcher: false } };
export const DelayedInitialization: Story = { args: { initializeDelay: 1500 } };
export const Disabled: Story = { args: { shouldInitialize: false } };
export const Mobile: Story = {
  globals: { viewport: { value: "iphone14", isRotated: false } },
};
