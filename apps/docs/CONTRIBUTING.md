# Contribute to the docs

Read the implementation behind a feature before documenting it. Test the instructions from the reader's starting point, including how they get any IDs, credentials, or files the example needs.

## Write for the person doing the work

- Use everyday English, short paragraphs, and sentence-case headings.
- Start with what the reader can accomplish and what they need first.
- Use the actual labels in the interface. Explain a term before relying on it.
- Avoid marketing filler, unnecessary warnings, and em dashes.
- Explain the result of an action, plus how to change or undo it when relevant.
- Keep setup tutorials separate from detailed configuration references.
- Use example.com domains and fictional people. Never include live credentials or private project data.

## Add useful images

Use real app screenshots with fictional data. Include both themes where available, descriptive alt text, and a caption that tells readers what to notice. Put the image next to the step it explains. Use diagrams for system relationships instead of inventing screenshots of an interface.

See [the screenshot guide](images/product/README.md) for reproduction. Verify the page at desktop and mobile widths, and check that the right screenshot appears in each theme.

## Check your change

From `apps/docs`, run `pnpm dlx mint validate` and `pnpm dlx mint broken-links`. Preview with `pnpm dlx mint dev` and follow the updated navigation and instructions in a browser.

Keep existing page URLs where possible. When a URL must change, add a redirect in `docs.json` and update internal links. Add new guide pages to the appropriate navigation group.

API route and schema changes require `pnpm openapi:check:fix` from the repository root. Do not hand-edit generated endpoint contracts to conceal a mismatch. Older links under `api-reference/endpoints/` are kept as thin pages pointing at the same schema; update their method and path when a route moves, and let OpenAPI supply their descriptions.

In your pull request, say which instructions you executed and which you only reviewed. A successful docs build does not prove an installation or restore works.
