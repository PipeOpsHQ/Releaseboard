export type GitProvider = "github" | "gitlab" | "bitbucket" | "gitea";

export interface RepoSource {
  id: string;
  pageId: string;
  displayName: string;
  provider: GitProvider;
  owner: string;
  repo: string;
  baseUrl: string | null;
  isPrivate: boolean;
  hasToken: boolean;
  enabled: boolean;
  releasesLimit: number;
  createdAt: string;
  updatedAt: string;
}

export type RootPageMode = "landing" | "changelog";

export interface AppSettings {
  rootPage: RootPageMode;
  updatedAt: string;
}

export interface RepoSourceWithToken extends RepoSource {
  token: string | null;
}

export interface ChangelogPage {
  id: string;
  name: string;
  pathName: string;
  customDomain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AggregatedRelease {
  id: string;
  sourceId: string;
  sourceName: string;
  provider: GitProvider;
  repository: string;
  kind: "release" | "commit";
  tagName: string;
  name: string;
  body: string;
  bodyExcerpt: string;
  htmlUrl: string;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string;
}

export interface SourceFetchError {
  sourceId: string;
  sourceName: string;
  repository: string;
  message: string;
}

export interface UnifiedChangelog {
  fetchedAt: string;
  releases: AggregatedRelease[];
  errors: SourceFetchError[];
}
