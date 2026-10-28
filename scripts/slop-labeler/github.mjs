const maxResponseBytes = 8_000_000;

export function validateRepository(repository) {
  if (!/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repository ?? "")) {
    throw new Error("Invalid GitHub repository.");
  }
  return repository;
}

export class GitHub {
  constructor(env, fetcher = fetch) {
    if (!env.GH_TOKEN) throw new Error("Missing GitHub token.");
    const api = new URL(env.GITHUB_API_URL || "https://api.github.com");
    if (
      api.protocol !== "https:" ||
      api.username ||
      api.password ||
      api.search ||
      api.hash
    ) {
      throw new Error("Invalid GitHub API URL.");
    }
    this.api = api.href.replace(/\/$/, "");
    this.repository = validateRepository(env.GITHUB_REPOSITORY);
    this.fetcher = fetcher;
    this.headers = {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async request(path, { method = "GET", body, allowMissing = false } = {}) {
    const response = await this.fetcher(`${this.api}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (allowMissing && response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(
        `GitHub ${method} request failed (${response.status}).`,
      );
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;

    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxResponseBytes) {
        throw new Error("GitHub response exceeded the scan limit.");
      }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  async list(path, maxPages = 30) {
    const items = [];
    for (let page = 1; page <= maxPages; page++) {
      const result = await this.request(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(result))
        throw new Error("Invalid GitHub list response.");
      items.push(...result);
      if (result.length < 100) return items;
    }
    throw new Error("GitHub pagination exceeded the scan limit.");
  }

  async source(file, headRepository) {
    if (!/^[a-f0-9]{40}$/.test(file.sha ?? "")) {
      throw new Error("Invalid GitHub source blob SHA.");
    }
    const suffix = `/git/blobs/${file.sha}`;
    let blob = await this.request(`/repos/${this.repository}${suffix}`, {
      allowMissing: true,
    });
    if (!blob && headRepository !== this.repository) {
      blob = await this.request(
        `/repos/${validateRepository(headRepository)}${suffix}`,
      );
    }
    if (
      !blob ||
      blob.encoding !== "base64" ||
      typeof blob.content !== "string" ||
      blob.sha !== file.sha
    ) {
      throw new Error("GitHub did not return the requested source blob.");
    }
    const content = Buffer.from(blob.content, "base64");
    if (content.length !== blob.size) {
      throw new Error("GitHub returned incomplete source content.");
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  }
}
