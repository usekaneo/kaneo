import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import {
	AttachmentCard,
	isEmbeddableVideoAttachment,
	parseAttachmentMimeType,
} from "./attachment-card";

describe("AttachmentCard", () => {
	it("is a block node so text below it is stored in a separate paragraph", () => {
		expect(AttachmentCard.config.group).toBe("block");
		expect(AttachmentCard.config.inline).toBe(false);
	});

	it("splits an active paragraph around an inserted video attachment", () => {
		const editor = new Editor({
			extensions: [StarterKit, Markdown, AttachmentCard],
			content: "text before video",
		});

		editor.commands.setTextSelection(editor.state.doc.content.size - 1);
		editor
			.chain()
			.insertContent([
				{
					type: "attachmentCard",
					attrs: {
						url: "https://example.com/recording.mp4",
						filename: "recording.mp4",
						mimeType: "video/mp4",
						size: 1024,
					},
				},
				{ type: "paragraph" },
			])
			.run();

		expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
			"paragraph",
			"attachmentCard",
			"paragraph",
		]);
		expect(editor.view.dom.children[1]?.tagName).toBe("KANEO-ATTACHMENT");
		editor.destroy();
	});

	it("restores the MIME type from saved attachment markup", () => {
		const element = document.createElement("kaneo-attachment");
		element.setAttribute("mime-type", "video/mp4");

		expect(parseAttachmentMimeType(element)).toBe("video/mp4");
	});

	it("preserves the paragraph immediately below a video through Markdown", () => {
		const editor = new Editor({
			extensions: [StarterKit, Markdown, AttachmentCard],
			content: {
				type: "doc",
				content: [
					{
						type: "attachmentCard",
						attrs: {
							url: "https://example.com/recording.mp4",
							filename: "recording.mp4",
							mimeType: "video/mp4",
							size: 1024,
						},
					},
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "saved below video",
								marks: [{ type: "bold" }],
							},
						],
					},
				],
			},
		});

		const markdown = editor.getMarkdown();
		editor.commands.setContent(markdown, { contentType: "markdown" });

		expect(markdown).toContain("**saved below video**");
		expect(editor.getText()).toContain("saved below video");
		expect(editor.getJSON().content?.[1]?.content?.[0]?.marks).toEqual([
			{ type: "bold" },
		]);
		editor.destroy();
	});

	it("adds an editable paragraph after an existing video at document end", () => {
		const editor = new Editor({
			extensions: [
				StarterKit.configure({ trailingNode: {} }),
				Markdown,
				AttachmentCard,
			],
		});

		editor.commands.setContent(
			'<kaneo-attachment url="https://example.com/recording.mp4" filename="recording.mp4" mime-type="video/mp4" size="1024" />',
			{ contentType: "markdown" },
		);

		expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
		editor.destroy();
	});

	it.each([
		["video/mp4", "recording", "https://example.com/file", true],
		["", "recording.mp4", "https://example.com/file", true],
		["", "recording", "https://example.com/file.mp4?token=abc", true],
		["application/pdf", "document.pdf", "https://example.com/file", false],
	])(
		"detects an embeddable video from its persisted metadata",
		(mimeType, filename, url, expected) => {
			expect(isEmbeddableVideoAttachment(mimeType, filename, url)).toBe(
				expected,
			);
		},
	);
});
