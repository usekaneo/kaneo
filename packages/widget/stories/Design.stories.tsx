import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { WidgetPreview } from "./WidgetPreview.js";

const meta = {
  title: "Widget/Design",
  component: WidgetPreview,
  render: (args) => <WidgetPreview key={JSON.stringify(args)} {...args} />,
  args: {
    initialTab: "home",
    theme: "light",
    placement: "right",
    empty: false,
    failSubmission: false,
    longContent: false,
    pendingSubmission: false,
    withConversation: false,
    loadFailure: false,
    latency: 250,
  },
  argTypes: {
    initialTab: {
      control: "select",
      options: ["home", "messages", "help", "feedback", "updates"],
    },
    theme: { control: "inline-radio", options: ["light", "dark", "auto"] },
    placement: { control: "inline-radio", options: ["left", "right"] },
  },
} satisfies Meta<typeof WidgetPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {};
export const Messages: Story = { args: { initialTab: "messages" } };
export const Help: Story = { args: { initialTab: "help" } };
export const Feedback: Story = { args: { initialTab: "feedback" } };
export const Updates: Story = { args: { initialTab: "updates" } };
export const Dark: Story = { args: { theme: "dark" } };
export const Mobile: Story = {
  globals: { viewport: { value: "iphone14", isRotated: false } },
};
export const Empty: Story = { args: { initialTab: "feedback", empty: true } };
export const Connected: Story = { args: { withConversation: true } };
export const Loading: Story = { args: { latency: 10000 } };
export const LoadFailure: Story = { args: { loadFailure: true } };
export const Offline: Story = {
  args: { withConversation: true },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole("button", { name: /You have a new reply/ });
    await userEvent.click(canvas.getByRole("button", { name: "Go offline" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "You’re offline.",
    );
  },
};
export const Conversation: Story = {
  args: { withConversation: true, initialTab: "messages" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Getting started with feedback/,
      }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Your reply" }),
    ).toBeVisible();
  },
};
export const DraftContinuity: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Write a message/ }),
    );
    await userEvent.type(
      canvas.getByRole("textbox"),
      "I need help with feedback",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /Browse help without losing/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(canvas.getByRole("textbox")).toHaveValue(
      "I need help with feedback",
    );
  },
};
export const FeedbackActions: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Linear integration/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Vote ·/ }));
    await expect(
      await canvas.findByRole("button", { name: /^Voted ·/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow request" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Following" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};
export const LongContent: Story = {
  args: { initialTab: "updates", longContent: true },
};
export const SearchNoResults: Story = {
  args: { initialTab: "help" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      await canvas.findByRole("searchbox"),
      "No matching article",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "No articles match your search.",
    );
  },
};
export const PendingSubmission: Story = {
  args: { initialTab: "messages", pendingSubmission: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "New conversation" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Your message" }),
      "Could you help me get started?",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await expect(
      canvas.getByRole("button", { name: "Sending…" }),
    ).toBeDisabled();
  },
};
export const FailedSubmission: Story = {
  args: { initialTab: "feedback", failSubmission: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Submit feedback" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Your feedback" }),
      "Keep this draft if sending fails.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Post" }));
    await expect(await canvas.findByRole("alert")).toBeVisible();
    await expect(canvas.getByRole("textbox")).toHaveValue(
      "Keep this draft if sending fails.",
    );
  },
};
export const SubmitFeedback: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Submit feedback" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Your feedback" }),
      "A new demo idea",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Post" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "Feedback submitted.",
    );
    await expect(
      canvas.getByRole("button", { name: /A new demo idea/ }),
    ).toBeVisible();
  },
};

export const ExpandedUpdate: Story = {
  args: { initialTab: "updates" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /A new visitor map, better conversations/,
      }),
    );
    await expect(
      canvas.getByRole("heading", { name: "From the board" }),
    ).toBeInTheDocument();
  },
};
export const ExpandedHelp: Story = {
  args: { initialTab: "help" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole("searchbox"), "How to share");
    await userEvent.click(
      await canvas.findByRole("button", { name: /How to share feedback/ }),
    );
    await expect(
      canvas.getByRole("heading", { name: "Include an example" }),
    ).toBeInTheDocument();
  },
};
export const RequestDiscussion: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Webhooks/ }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Your comment" }),
    ).toBeVisible();
  },
};
export const Roadmap: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole("button", { name: /Webhooks/ });
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Sort feedback" }),
      "roadmap",
    );
    await expect(
      canvas.getByRole("heading", { name: "Roadmap" }),
    ).toBeVisible();
  },
};
export const NewConversation: Story = {
  args: { initialTab: "messages" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "New conversation" }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Your message" }),
    ).toBeVisible();
  },
};
export const FeedbackComposer: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Submit feedback" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Capture screenshot" }),
    ).toBeVisible();
  },
};

export const Activity: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Linear integration/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow request" }),
    );
    await canvas.findByRole("button", { name: "Following" });
    await userEvent.click(
      canvas.getByRole("button", { name: "Simulate request progress" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Activity, unread updates" }),
    );
    await expect(canvas.getByText("Status changed to Shipped.")).toBeVisible();
  },
};
export const ArticleFeedback: Story = {
  args: { initialTab: "help" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole("searchbox"), "How to share");
    await userEvent.click(
      await canvas.findByRole("button", { name: /How to share feedback/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Yes" }));
    await expect(
      await canvas.findByText("Thanks for your feedback."),
    ).toBeVisible();
  },
};
export const ConversationReading: Story = {
  ...Conversation,
  args: { withConversation: true, initialTab: "messages", longContent: true },
};
export const ImageViewer: Story = {
  args: { initialTab: "feedback" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Submit feedback" }),
    );
    const image = document.createElement("canvas");
    image.width = 640;
    image.height = 400;
    const context = image.getContext("2d")!;
    context.fillStyle = "#eeece8";
    context.fillRect(0, 0, 640, 400);
    context.fillStyle = "#282624";
    context.font = "24px sans-serif";
    context.fillText("Example attachment", 32, 64);
    const blob = await new Promise<Blob>((resolve) =>
      image.toBlob((blob) => resolve(blob!), "image/png"),
    );
    await userEvent.upload(canvas.getByLabelText("Choose images"), [
      new File([blob], "example.png", { type: "image/png" }),
      new File([blob], "detail.png", { type: "image/png" }),
    ]);
    await canvas.findByRole("button", { name: "Edit example.png" });
    await userEvent.type(canvas.getByRole("textbox"), "Image viewer example");
    await userEvent.click(canvas.getByRole("button", { name: "Post" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: /Image viewer example/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open attachment example.png" }),
    );
    await expect(canvas.getByRole("dialog")).toBeVisible();
  },
};
