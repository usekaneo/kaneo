import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { LauncherPreview } from "./LauncherPreview.js";

const meta = {
  title: "Widget/Launcher",
  component: LauncherPreview,
  args: {
    placement: "right",
    label: "",
    greeting: "",
    unread: 0,
    open: false,
    backgroundColor: "#ffffff",
    foregroundColor: "#171717",
  },
  argTypes: {
    placement: { control: "inline-radio", options: ["left", "right"] },
    unread: { control: { type: "number", min: 0, step: 1 } },
    backgroundColor: { control: "color" },
    foregroundColor: { control: "color" },
  },
} satisfies Meta<typeof LauncherPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const launcher = await canvas.findByRole("button", {
      name: "Open feedback widget",
    });
    await userEvent.click(launcher);
    await expect(launcher).toHaveAttribute("aria-expanded", "true");
    await expect(launcher).not.toBeVisible();
  },
};
export const LabelAndGreeting: Story = {
  args: { label: "Help desk", greeting: "Need a hand?" },
};
export const Unread: Story = { args: { unread: 4 } };
export const UnreadOverflow: Story = { args: { unread: 42 } };
export const LeftAligned: Story = {
  args: { placement: "left", greeting: "Share your feedback" },
};
export const Open: Story = { args: { open: true, unread: 4 } };
