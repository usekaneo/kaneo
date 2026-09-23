import path from "node:path";
import { PNG } from "pngjs";
import { REPO } from "./core.mjs";
import { readScreenshot } from "./images.mjs";

const BRANCH = "code/ui-screenshots";

export async function uploadScreenshots(run, folder, api) {
  if (!folder || !/^[a-zA-Z0-9-]{1,80}$/.test(run.id))
    throw new Error("A screenshot folder and valid run ID are required.");
  const files = [];
  for (const [index, item] of run.results.slice(0, 3).entries()) {
    if (item.status !== "captured" || item.after?.ok !== true)
      throw new Error(
        "Only successfully captured PR screenshots can be published.",
      );
    const preview = Boolean(item.focus);
    if (preview && item.after.preview !== true)
      throw new Error("Missing focused preview.");
    const filename = path.join(
      folder,
      `${index}-${preview ? "preview" : "after"}.png`,
    );
    const png = await readScreenshot(filename, { preview });
    const bytes = PNG.sync.write(png);
    if (preview && files.some((file) => file.bytes.equals(bytes)))
      throw new Error(
        "Duplicate previews: choose distinct visible states before publishing.",
      );
    const caption = String(
      ["custom-fields", "time-tracking"].includes(run.fixtureProfile)
        ? item.name
        : item.review?.caption || "",
    ).trim();
    files.push({
      path: `screenshots/pr-${run.prNumber}/${run.id}/${index + 1}.png`,
      bytes,
      description:
        caption && caption.length <= 70
          ? caption
          : String(item.name || `Screenshot ${index + 1}`).slice(0, 70),
    });
  }
  const prefix = `repos/${REPO}/git`;
  const entries = [];
  for (const file of files) {
    const blob = await api(`${prefix}/blobs`, {
      method: "POST",
      body: { content: file.bytes.toString("base64"), encoding: "base64" },
    });
    entries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }
  let commit;
  for (let attempt = 0; attempt < 3; attempt++) {
    const refs = await api(`${prefix}/matching-refs/heads/${BRANCH}`);
    const previous = refs.find((r) => r.ref === `refs/heads/${BRANCH}`)?.object
      .sha;
    const parent = previous
      ? await api(`${prefix}/commits/${previous}`)
      : undefined;
    const tree = await api(`${prefix}/trees`, {
      method: "POST",
      body: {
        ...(parent ? { base_tree: parent.tree.sha } : {}),
        tree: entries,
      },
    });
    commit = await api(`${prefix}/commits`, {
      method: "POST",
      body: {
        message: `UI screenshots for #${run.prNumber}`,
        tree: tree.sha,
        parents: previous ? [previous] : [],
      },
    });
    if (!/^[a-f0-9]{40}$/.test(commit.sha))
      throw new Error("GitHub returned an invalid image commit.");
    try {
      if (previous)
        await api(`${prefix}/refs/heads/${BRANCH}`, {
          method: "PATCH",
          body: { sha: commit.sha, force: false },
        });
      else
        await api(`${prefix}/refs`, {
          method: "POST",
          body: { ref: `refs/heads/${BRANCH}`, sha: commit.sha },
        });
      break;
    } catch (error) {
      if (![409, 422].includes(error.status) || attempt === 2) throw error;
    }
  }
  return files.map((file) => ({
    description: file.description,
    url: `https://raw.githubusercontent.com/${REPO}/${commit.sha}/${file.path}`,
  }));
}
