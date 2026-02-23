import type { AggregatedRelease, GitProvider, RepoSourceWithToken } from "@/lib/types";
import { fetchWithRetry } from "@/lib/fetch-utils";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string | null;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      date: string | null;
    } | null;
  };
}

interface GitLabRelease {
  tag_name: string;
  name: string | null;
  description: string | null;
  released_at: string | null;
  created_at: string | null;
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  authored_date: string | null;
  web_url: string;
}

interface GiteaRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string | null;
}

interface GiteaCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      date: string | null;
    } | null;
  };
}

interface BitbucketCommitResponse {
  values: BitbucketCommit[];
}

interface BitbucketCommit {
  hash: string;
  message: string;
  date: string | null;
  links?: {
    html?: {
      href?: string;
    };
  };
}

interface BitbucketServerCommitResponse {
  values: BitbucketServerCommit[];
}

interface BitbucketServerCommit {
  id: string;
  displayId?: string;
  message: string;
  authorTimestamp?: number;
  links?: {
    self?: Array<{
      href?: string;
    }>;
  };
}

const RELEASES_PREVIEW_LIMIT = 480;
const COMMITS_PREVIEW_LIMIT = 360;

function markdownToPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isBitbucketServerApiBase(apiBase: string): boolean {
  return /\/rest\/api\/\d+\.\d+$/i.test(apiBase);
}

function inferApiBaseUrl(source: RepoSourceWithToken): string {
  const configuredBase = source.baseUrl ? trimTrailingSlashes(source.baseUrl) : null;

  if (source.provider === "github") {
    if (!configuredBase) {
      return "https://api.github.com";
    }

    if (/^https?:\/\/github\.com$/i.test(configuredBase)) {
      return "https://api.github.com";
    }

    if (configuredBase.includes("api.github.com")) {
      return "https://api.github.com";
    }

    if (configuredBase.endsWith("/api/v3")) {
      return configuredBase;
    }

    return `${configuredBase}/api/v3`;
  }

  if (source.provider === "gitlab") {
    const base = configuredBase ?? "https://gitlab.com";
    return base.endsWith("/api/v4") ? base : `${base}/api/v4`;
  }

  if (source.provider === "gitea") {
    const base = configuredBase ?? "https://gitea.com";
    return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  }

  if (!configuredBase) {
    return "https://api.bitbucket.org/2.0";
  }

  if (configuredBase.includes("api.bitbucket.org")) {
    return configuredBase.endsWith("/2.0") ? configuredBase : `${configuredBase}/2.0`;
  }

  if (/\/rest\/api\/\d+\.\d+$/i.test(configuredBase)) {
    return configuredBase;
  }

  if (configuredBase.includes("bitbucket.org")) {
    return "https://api.bitbucket.org/2.0";
  }

  return `${configuredBase}/rest/api/1.0`;
}

function inferWebBaseUrl(source: RepoSourceWithToken): string {
  const configuredBase = source.baseUrl ? trimTrailingSlashes(source.baseUrl) : null;

  if (source.provider === "github") {
    if (!configuredBase) {
      return "https://github.com";
    }

    if (configuredBase.includes("api.github.com")) {
      return "https://github.com";
    }

    return configuredBase.replace(/\/api\/v3$/, "");
  }

  if (source.provider === "gitlab") {
    const base = configuredBase ?? "https://gitlab.com";
    return base.replace(/\/api\/v4$/, "");
  }

  if (source.provider === "gitea") {
    const base = configuredBase ?? "https://gitea.com";
    return base.replace(/\/api\/v1$/, "");
  }

  if (!configuredBase) {
    return "https://bitbucket.org";
  }

  if (configuredBase.includes("api.bitbucket.org")) {
    return "https://bitbucket.org";
  }

  if (/\/rest\/api\/\d+\.\d+$/i.test(configuredBase)) {
    return configuredBase.replace(/\/rest\/api\/\d+\.\d+$/i, "");
  }

  return configuredBase.replace(/\/2\.0$/, "");
}

function buildReleaseId(sourceId: string, releaseId: string | number): string {
  return `${sourceId}:${String(releaseId)}`;
}

function buildCommitId(sourceId: string, sha: string): string {
  return `${sourceId}:commit:${sha}`;
}

function formatApiError(provider: GitProvider, status: number, detail: string): string {
  const label = provider[0]?.toUpperCase() + provider.slice(1);
  const statusMessage = detail.slice(0, 140).trim();
  return statusMessage ? `${label} API ${status}: ${statusMessage}` : `${label} API returned ${status}`;
}

function createHeaders(source: RepoSourceWithToken): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "User-Agent": "pipeops-changelog"
  });

  if (!source.token) {
    return headers;
  }

  if (source.provider === "gitlab") {
    headers.set("PRIVATE-TOKEN", source.token);
    return headers;
  }

  if (source.provider === "gitea") {
    headers.set("Authorization", `token ${source.token}`);
    return headers;
  }

  if (source.provider === "bitbucket" && source.token.includes(":")) {
    headers.set("Authorization", `Basic ${Buffer.from(source.token).toString("base64")}`);
    return headers;
  }

  headers.set("Authorization", `Bearer ${source.token}`);
  return headers;
}

function mapGitHubCommitsToEntries(source: RepoSourceWithToken, commits: GitHubCommit[]): AggregatedRelease[] {
  return commits.map<AggregatedRelease>((commit) => {
    const message = (commit.commit.message || "").trim();
    const title = message.split("\n")[0]?.trim() || `Commit ${commit.sha.slice(0, 7)}`;
    const excerpt = markdownToPlainText(message).slice(0, COMMITS_PREVIEW_LIMIT);

    return {
      id: buildCommitId(source.id, commit.sha),
      sourceId: source.id,
      sourceName: source.displayName,
      provider: source.provider,
      repository: `${source.owner}/${source.repo}`,
      kind: "commit",
      tagName: commit.sha.slice(0, 7),
      name: title,
      body: message,
      bodyExcerpt: excerpt,
      htmlUrl: commit.html_url,
      prerelease: false,
      draft: false,
      publishedAt: commit.commit.author?.date ?? new Date(0).toISOString()
    };
  });
}

function mapGitLabCommitsToEntries(source: RepoSourceWithToken, commits: GitLabCommit[]): AggregatedRelease[] {
  return commits.map<AggregatedRelease>((commit) => {
    const message = (commit.message || "").trim();
    const title = commit.title?.trim() || message.split("\n")[0]?.trim() || `Commit ${commit.short_id}`;
    const excerpt = markdownToPlainText(message).slice(0, COMMITS_PREVIEW_LIMIT);

    return {
      id: buildCommitId(source.id, commit.id),
      sourceId: source.id,
      sourceName: source.displayName,
      provider: source.provider,
      repository: `${source.owner}/${source.repo}`,
      kind: "commit",
      tagName: (commit.short_id || commit.id).slice(0, 8),
      name: title,
      body: message,
      bodyExcerpt: excerpt,
      htmlUrl: commit.web_url,
      prerelease: false,
      draft: false,
      publishedAt: commit.authored_date ?? new Date(0).toISOString()
    };
  });
}

function mapBitbucketCommitsToEntries(source: RepoSourceWithToken, commits: BitbucketCommit[]): AggregatedRelease[] {
  const webBase = inferWebBaseUrl(source);

  return commits.map<AggregatedRelease>((commit) => {
    const message = (commit.message || "").trim();
    const shortHash = commit.hash.slice(0, 8);
    const title = message.split("\n")[0]?.trim() || `Commit ${shortHash}`;
    const excerpt = markdownToPlainText(message).slice(0, COMMITS_PREVIEW_LIMIT);
    const htmlUrl = commit.links?.html?.href ?? `${webBase}/${source.owner}/${source.repo}/commits/${commit.hash}`;

    return {
      id: buildCommitId(source.id, commit.hash),
      sourceId: source.id,
      sourceName: source.displayName,
      provider: source.provider,
      repository: `${source.owner}/${source.repo}`,
      kind: "commit",
      tagName: shortHash,
      name: title,
      body: message,
      bodyExcerpt: excerpt,
      htmlUrl,
      prerelease: false,
      draft: false,
      publishedAt: commit.date ?? new Date(0).toISOString()
    };
  });
}

function mapBitbucketServerCommitsToEntries(
  source: RepoSourceWithToken,
  commits: BitbucketServerCommit[]
): AggregatedRelease[] {
  const webBase = inferWebBaseUrl(source);

  return commits.map<AggregatedRelease>((commit) => {
    const message = (commit.message || "").trim();
    const shortHash = (commit.displayId || commit.id).slice(0, 8);
    const title = message.split("\n")[0]?.trim() || `Commit ${shortHash}`;
    const excerpt = markdownToPlainText(message).slice(0, COMMITS_PREVIEW_LIMIT);
    const fallbackUrl = `${webBase}/projects/${source.owner}/repos/${source.repo}/commits/${commit.id}`;
    const htmlUrl = commit.links?.self?.[0]?.href ?? fallbackUrl;

    return {
      id: buildCommitId(source.id, commit.id),
      sourceId: source.id,
      sourceName: source.displayName,
      provider: source.provider,
      repository: `${source.owner}/${source.repo}`,
      kind: "commit",
      tagName: shortHash,
      name: title,
      body: message,
      bodyExcerpt: excerpt,
      htmlUrl,
      prerelease: false,
      draft: false,
      publishedAt: commit.authorTimestamp
        ? new Date(commit.authorTimestamp).toISOString()
        : new Date(0).toISOString()
    };
  });
}

async function fetchGitHubCommitFallback(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const url = new URL(`${apiBase}/repos/${source.owner}/${source.repo}/commits`);
  url.searchParams.set("per_page", String(source.releasesLimit));

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { releases: [], error: formatApiError(source.provider, response.status, detail) };
  }

  const payload = (await response.json()) as GitHubCommit[];
  return {
    releases: mapGitHubCommitsToEntries(source, payload),
    error: null
  };
}

async function fetchGitLabCommitFallback(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const projectId = encodeURIComponent(`${source.owner}/${source.repo}`);
  const url = new URL(`${apiBase}/projects/${projectId}/repository/commits`);
  url.searchParams.set("per_page", String(source.releasesLimit));

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { releases: [], error: formatApiError(source.provider, response.status, detail) };
  }

  const payload = (await response.json()) as GitLabCommit[];
  return {
    releases: mapGitLabCommitsToEntries(source, payload),
    error: null
  };
}

async function fetchBitbucketCommitFallback(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const useServerApi = isBitbucketServerApiBase(apiBase);
  const url = useServerApi
    ? new URL(`${apiBase}/projects/${encodeURIComponent(source.owner)}/repos/${encodeURIComponent(source.repo)}/commits`)
    : new URL(`${apiBase}/repositories/${source.owner}/${source.repo}/commits`);

  if (useServerApi) {
    url.searchParams.set("limit", String(Math.min(100, Math.max(1, source.releasesLimit))));
  } else {
    url.searchParams.set("pagelen", String(Math.min(100, Math.max(1, source.releasesLimit))));
  }

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { releases: [], error: formatApiError(source.provider, response.status, detail) };
  }

  if (useServerApi) {
    const payload = (await response.json()) as BitbucketServerCommitResponse;
    const commits = payload.values || [];

    return {
      releases: mapBitbucketServerCommitsToEntries(source, commits),
      error: null
    };
  }

  const payload = (await response.json()) as BitbucketCommitResponse;
  const commits = payload.values || [];
  return {
    releases: mapBitbucketCommitsToEntries(source, commits),
    error: null
  };
}

async function fetchGitHubSource(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const url = new URL(`${apiBase}/repos/${source.owner}/${source.repo}/releases`);
  url.searchParams.set("per_page", String(source.releasesLimit));

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    const releaseError = formatApiError(source.provider, response.status, detail);

    // Stop early if hit a Github Rate limit so we don't spam the commit API additionally
    if (response.status === 403 && detail.includes("rate limit")) {
      return { releases: [], error: releaseError };
    }

    const commitFallback = await fetchGitHubCommitFallback(source);

    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }

    return { releases: [], error: commitFallback.error ?? releaseError };
  }

  const payload = (await response.json()) as GitHubRelease[];
  const releases = payload
    .filter((release) => Boolean(release.published_at || release.name || release.tag_name))
    .map<AggregatedRelease>((release) => {
      const body = release.body ?? "";
      const bodyExcerpt = markdownToPlainText(body).slice(0, RELEASES_PREVIEW_LIMIT);

      return {
        id: buildReleaseId(source.id, release.id),
        sourceId: source.id,
        sourceName: source.displayName,
        provider: source.provider,
        repository: `${source.owner}/${source.repo}`,
        kind: "release",
        tagName: release.tag_name,
        name: release.name ?? release.tag_name,
        body,
        bodyExcerpt,
        htmlUrl: release.html_url,
        prerelease: release.prerelease,
        draft: release.draft,
        publishedAt: release.published_at ?? new Date(0).toISOString()
      };
    });

  if (releases.length === 0) {
    const commitFallback = await fetchGitHubCommitFallback(source);
    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }

    return { releases: [], error: commitFallback.error };
  }

  return { releases, error: null };
}

async function fetchGitLabSource(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const webBase = inferWebBaseUrl(source);
  const projectId = encodeURIComponent(`${source.owner}/${source.repo}`);
  const url = new URL(`${apiBase}/projects/${projectId}/releases`);
  url.searchParams.set("per_page", String(source.releasesLimit));

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    const releaseError = formatApiError(source.provider, response.status, detail);

    // Stop early if hit a Gitlab Rate limit
    if (response.status === 429) {
      return { releases: [], error: releaseError };
    }

    const commitFallback = await fetchGitLabCommitFallback(source);

    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }

    return { releases: [], error: commitFallback.error ?? releaseError };
  }

  const payload = (await response.json()) as GitLabRelease[];
  const releases = payload
    .filter((release) => Boolean(release.tag_name || release.name || release.released_at))
    .map<AggregatedRelease>((release) => {
      const body = release.description ?? "";
      const bodyExcerpt = markdownToPlainText(body).slice(0, RELEASES_PREVIEW_LIMIT);
      const htmlUrl = `${webBase}/${source.owner}/${source.repo}/-/releases/${release.tag_name}`;

      return {
        id: buildReleaseId(source.id, release.tag_name),
        sourceId: source.id,
        sourceName: source.displayName,
        provider: source.provider,
        repository: `${source.owner}/${source.repo}`,
        kind: "release",
        tagName: release.tag_name,
        name: release.name ?? release.tag_name,
        body,
        bodyExcerpt,
        htmlUrl,
        prerelease: false,
        draft: false,
        publishedAt: release.released_at ?? release.created_at ?? new Date(0).toISOString()
      };
    });

  if (releases.length === 0) {
    const commitFallback = await fetchGitLabCommitFallback(source);
    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }

    return { releases: [], error: commitFallback.error };
  }

  return { releases, error: null };
}

async function fetchGiteaSource(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  const apiBase = inferApiBaseUrl(source);
  const url = new URL(`${apiBase}/repos/${source.owner}/${source.repo}/releases`);
  url.searchParams.set("limit", String(source.releasesLimit));

  let response: Response;
  try {
    response = await fetchWithRetry(url.toString(), {
      headers: createHeaders(source),
      next: { revalidate: 300 }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { releases: [], error: `Network error: ${message}` };
  }

  async function fetchGiteaCommitFallback(): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
    const commitUrl = new URL(`${apiBase}/repos/${source.owner}/${source.repo}/commits`);
    commitUrl.searchParams.set("limit", String(source.releasesLimit));

    let commitResponse: Response;
    try {
      commitResponse = await fetchWithRetry(commitUrl.toString(), {
        headers: createHeaders(source),
        next: { revalidate: 300 }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      return { releases: [], error: `Network error: ${message}` };
    }

    if (!commitResponse.ok) {
      const detail = await commitResponse.text();
      return { releases: [], error: formatApiError(source.provider, commitResponse.status, detail) };
    }

    const payload = (await commitResponse.json()) as GiteaCommit[];
    return {
      releases: mapGitHubCommitsToEntries(
        source,
        payload.map((commit) => ({
          sha: commit.sha,
          html_url: commit.html_url,
          commit: commit.commit
        }))
      ),
      error: null
    };
  }

  if (!response.ok) {
    const detail = await response.text();
    const releaseError = formatApiError(source.provider, response.status, detail);

    // Stop early if hit a Gitea Rate limit
    if (response.status === 429) {
      return { releases: [], error: releaseError };
    }

    const commitFallback = await fetchGiteaCommitFallback();
    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }
    return { releases: [], error: commitFallback.error ?? releaseError };
  }

  const payload = (await response.json()) as GiteaRelease[];
  const releases = payload
    .filter((release) => Boolean(release.published_at || release.name || release.tag_name))
    .map<AggregatedRelease>((release) => {
      const body = release.body ?? "";
      const bodyExcerpt = markdownToPlainText(body).slice(0, RELEASES_PREVIEW_LIMIT);

      return {
        id: buildReleaseId(source.id, release.id),
        sourceId: source.id,
        sourceName: source.displayName,
        provider: source.provider,
        repository: `${source.owner}/${source.repo}`,
        kind: "release",
        tagName: release.tag_name,
        name: release.name ?? release.tag_name,
        body,
        bodyExcerpt,
        htmlUrl: release.html_url,
        prerelease: release.prerelease,
        draft: release.draft,
        publishedAt: release.published_at ?? new Date(0).toISOString()
      };
    });

  if (releases.length === 0) {
    const commitFallback = await fetchGiteaCommitFallback();

    if (commitFallback.releases.length > 0) {
      return { releases: commitFallback.releases, error: null };
    }

    return { releases: [], error: commitFallback.error };
  }

  return { releases, error: null };
}

export async function fetchReleasesForSource(
  source: RepoSourceWithToken
): Promise<{ releases: AggregatedRelease[]; error: string | null }> {
  if (source.provider === "github") {
    return fetchGitHubSource(source);
  }

  if (source.provider === "gitlab") {
    return fetchGitLabSource(source);
  }

  if (source.provider === "gitea") {
    return fetchGiteaSource(source);
  }

  return fetchBitbucketCommitFallback(source);
}
