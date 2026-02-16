import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AppSettings,
  ChangelogPage,
  GitProvider,
  RepoSource,
  RepoSourceWithToken,
  RootPageMode,
  UnifiedChangelog
} from "@/lib/types";
import { decryptToken, encryptToken } from "@/lib/security";

interface SourceRow {
  id: string;
  page_id: string;
  display_name: string;
  provider: string;
  owner: string;
  repo: string;
  base_url: string | null;
  is_private: number;
  token_encrypted: string | null;
  enabled: number;
  releases_limit: number;
  created_at: string;
  updated_at: string;
}

interface PageRow {
  id: string;
  name: string;
  path_name: string;
  custom_domain: string | null;
  created_at: string;
  updated_at: string;
}

interface SourceCreateInput {
  pageId: string;
  displayName: string;
  provider: GitProvider;
  owner: string;
  repo: string;
  baseUrl: string | null;
  isPrivate: boolean;
  token: string | null;
  enabled: boolean;
  releasesLimit: number;
}

interface SourceUpdateInput {
  id: string;
  pageId: string;
  displayName: string;
  provider: GitProvider;
  owner: string;
  repo: string;
  baseUrl: string | null;
  isPrivate: boolean;
  token?: string | null;
  enabled: boolean;
  releasesLimit: number;
}

interface PageCreateInput {
  name: string;
  pathName: string;
  customDomain: string | null;
}

interface PageUpdateInput {
  id: string;
  name: string;
  pathName: string;
  customDomain: string | null;
}

interface AppSettingsRow {
  id: number;
  root_page: RootPageMode;
  updated_at: string;
}

interface ChangelogSnapshotRow {
  page_id: string;
  fetched_at: string;
  payload_json: string;
  updated_at: string;
}

interface LegacyChangelogSnapshotRow {
  id: number;
  fetched_at: string;
  payload_json: string;
  updated_at: string;
}

export const DEFAULT_CHANGELOG_PAGE_ID = "page_default";
export const DEFAULT_CHANGELOG_PATH_NAME = "changelog";

const RESERVED_PATHS = new Set(["admin", "api", "landing"]);
const dbPath = path.join(process.cwd(), "data", "changelog.db");
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

const SUPPORTED_PROVIDERS: GitProvider[] = ["github", "gitlab", "bitbucket", "gitea"];

function normalizeProvider(value: string | null | undefined): GitProvider {
  if (!value) {
    return "github";
  }

  const provider = value.toLowerCase().trim();
  if (SUPPORTED_PROVIDERS.includes(provider as GitProvider)) {
    return provider as GitProvider;
  }

  return "github";
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, "");
}

function normalizePathName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");

  if (!normalized) {
    throw new Error("Path name is required");
  }

  if (RESERVED_PATHS.has(normalized)) {
    throw new Error("Path name is reserved");
  }

  return normalized;
}

function normalizeDomain(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const domainOnly = withoutProtocol.split("/")[0]?.split(":")[0]?.trim();
  return domainOnly || null;
}

try {
  db.pragma("journal_mode = WAL");
} catch {
  // During highly parallel build steps the journal mode write can briefly lock.
}

db.exec(`
  CREATE TABLE IF NOT EXISTS changelog_pages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path_name TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS repo_sources (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL DEFAULT '${DEFAULT_CHANGELOG_PAGE_ID}',
    display_name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'github',
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    base_url TEXT,
    is_private INTEGER NOT NULL DEFAULT 0,
    token_encrypted TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    releases_limit INTEGER NOT NULL DEFAULT 8,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_repo_sources_enabled
  ON repo_sources(enabled);

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    root_page TEXT NOT NULL DEFAULT 'landing' CHECK (root_page IN ('landing', 'changelog')),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS changelog_snapshots (
    page_id TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- legacy single-page snapshot table kept for migration/backward compatibility
  CREATE TABLE IF NOT EXISTS changelog_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    fetched_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const now = new Date().toISOString();

// Ensure the default changelog page always exists.
db.prepare(
  `
    INSERT INTO changelog_pages (id, name, path_name, custom_domain, created_at, updated_at)
    VALUES (@id, @name, @path_name, NULL, @created_at, @updated_at)
    ON CONFLICT(id) DO NOTHING
  `
).run({
  id: DEFAULT_CHANGELOG_PAGE_ID,
  name: "Main Changelog",
  path_name: DEFAULT_CHANGELOG_PATH_NAME,
  created_at: now,
  updated_at: now
});

const repoSourceColumns = db.prepare("PRAGMA table_info(repo_sources)").all() as Array<{ name: string }>;
const hasProviderColumn = repoSourceColumns.some((column) => column.name === "provider");
const hasBaseUrlColumn = repoSourceColumns.some((column) => column.name === "base_url");
const hasPageIdColumn = repoSourceColumns.some((column) => column.name === "page_id");

if (!hasProviderColumn) {
  db.exec("ALTER TABLE repo_sources ADD COLUMN provider TEXT NOT NULL DEFAULT 'github'");
}

if (!hasBaseUrlColumn) {
  db.exec("ALTER TABLE repo_sources ADD COLUMN base_url TEXT");
}

if (!hasPageIdColumn) {
  db.exec(`ALTER TABLE repo_sources ADD COLUMN page_id TEXT NOT NULL DEFAULT '${DEFAULT_CHANGELOG_PAGE_ID}'`);
}

db.exec("CREATE INDEX IF NOT EXISTS idx_repo_sources_page_id ON repo_sources(page_id)");

db.prepare(
  `
    UPDATE repo_sources
    SET page_id = @default_page_id
    WHERE page_id IS NULL OR TRIM(page_id) = ''
  `
).run({ default_page_id: DEFAULT_CHANGELOG_PAGE_ID });

db.prepare(
  `
    INSERT INTO app_settings (id, root_page, updated_at)
    VALUES (1, 'landing', @updated_at)
    ON CONFLICT(id) DO NOTHING
  `
).run({ updated_at: now });

// Migrate legacy single-row snapshot to page-scoped snapshots if needed.
const hasDefaultSnapshot = Boolean(
  db.prepare("SELECT 1 FROM changelog_snapshots WHERE page_id = ?").get(DEFAULT_CHANGELOG_PAGE_ID)
);
if (!hasDefaultSnapshot) {
  const legacy = db.prepare("SELECT * FROM changelog_snapshot WHERE id = 1").get() as LegacyChangelogSnapshotRow | undefined;
  if (legacy) {
    db.prepare(
      `
        INSERT INTO changelog_snapshots (page_id, fetched_at, payload_json, updated_at)
        VALUES (@page_id, @fetched_at, @payload_json, @updated_at)
        ON CONFLICT(page_id) DO NOTHING
      `
    ).run({
      page_id: DEFAULT_CHANGELOG_PAGE_ID,
      fetched_at: legacy.fetched_at,
      payload_json: legacy.payload_json,
      updated_at: legacy.updated_at
    });
  }
}

function mapPageRow(row: PageRow): ChangelogPage {
  return {
    id: row.id,
    name: row.name,
    pathName: row.path_name,
    customDomain: normalizeDomain(row.custom_domain),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRow(row: SourceRow): RepoSource {
  return {
    id: row.id,
    pageId: row.page_id || DEFAULT_CHANGELOG_PAGE_ID,
    displayName: row.display_name,
    provider: normalizeProvider(row.provider),
    owner: row.owner,
    repo: row.repo,
    baseUrl: normalizeBaseUrl(row.base_url),
    isPrivate: row.is_private === 1,
    hasToken: Boolean(decryptToken(row.token_encrypted)),
    enabled: row.enabled === 1,
    releasesLimit: row.releases_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRowWithToken(row: SourceRow): RepoSourceWithToken {
  return {
    ...mapRow(row),
    token: decryptToken(row.token_encrypted)
  };
}

function getPageOrThrow(id: string): PageRow {
  const row = db.prepare("SELECT * FROM changelog_pages WHERE id = ?").get(id) as PageRow | undefined;
  if (!row) {
    throw new Error("Changelog page not found");
  }
  return row;
}

export function listChangelogPages(): ChangelogPage[] {
  const rows = db.prepare("SELECT * FROM changelog_pages ORDER BY created_at ASC").all() as PageRow[];
  return rows.map(mapPageRow);
}

export function getDefaultChangelogPage(): ChangelogPage {
  const row = db.prepare("SELECT * FROM changelog_pages WHERE id = ?").get(DEFAULT_CHANGELOG_PAGE_ID) as PageRow | undefined;
  if (!row) {
    throw new Error("Default changelog page missing");
  }
  return mapPageRow(row);
}

export function getChangelogPageById(id: string): ChangelogPage | null {
  const row = db.prepare("SELECT * FROM changelog_pages WHERE id = ?").get(id) as PageRow | undefined;
  return row ? mapPageRow(row) : null;
}

export function getChangelogPageByPath(pathName: string): ChangelogPage | null {
  try {
    const normalizedPath = normalizePathName(pathName);
    const row = db.prepare("SELECT * FROM changelog_pages WHERE path_name = ?").get(normalizedPath) as PageRow | undefined;
    return row ? mapPageRow(row) : null;
  } catch {
    return null;
  }
}

export function getChangelogPageByDomain(domain: string): ChangelogPage | null {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return null;
  }

  const row = db.prepare("SELECT * FROM changelog_pages WHERE custom_domain = ?").get(normalizedDomain) as PageRow | undefined;
  return row ? mapPageRow(row) : null;
}

export function createChangelogPage(input: PageCreateInput): ChangelogPage {
  const nowIso = new Date().toISOString();
  const id = randomUUID();
  const pathName = normalizePathName(input.pathName);
  const customDomain = normalizeDomain(input.customDomain);

  db.prepare(
    `
      INSERT INTO changelog_pages (id, name, path_name, custom_domain, created_at, updated_at)
      VALUES (@id, @name, @path_name, @custom_domain, @created_at, @updated_at)
    `
  ).run({
    id,
    name: input.name.trim(),
    path_name: pathName,
    custom_domain: customDomain,
    created_at: nowIso,
    updated_at: nowIso
  });

  return mapPageRow(getPageOrThrow(id));
}

export function updateChangelogPage(input: PageUpdateInput): ChangelogPage {
  const current = getPageOrThrow(input.id);
  const nowIso = new Date().toISOString();
  const pathName = normalizePathName(input.pathName);
  const customDomain = normalizeDomain(input.customDomain);

  if (current.id === DEFAULT_CHANGELOG_PAGE_ID && pathName !== DEFAULT_CHANGELOG_PATH_NAME) {
    throw new Error("Default changelog path cannot be changed");
  }

  db.prepare(
    `
      UPDATE changelog_pages
      SET name = @name, path_name = @path_name, custom_domain = @custom_domain, updated_at = @updated_at
      WHERE id = @id
    `
  ).run({
    id: input.id,
    name: input.name.trim(),
    path_name: pathName,
    custom_domain: customDomain,
    updated_at: nowIso
  });

  return mapPageRow(getPageOrThrow(input.id));
}

export function deleteChangelogPage(id: string): void {
  if (id === DEFAULT_CHANGELOG_PAGE_ID) {
    throw new Error("Default changelog page cannot be deleted");
  }

  const sourceCountRow = db
    .prepare("SELECT COUNT(*) as count FROM repo_sources WHERE page_id = ?")
    .get(id) as { count: number };

  if (sourceCountRow.count > 0) {
    throw new Error("Remove or reassign sources before deleting this page");
  }

  db.prepare("DELETE FROM changelog_snapshots WHERE page_id = ?").run(id);
  db.prepare("DELETE FROM changelog_pages WHERE id = ?").run(id);
}

export function listRepoSources(pageId?: string): RepoSource[] {
  const normalizedPageId = pageId?.trim();

  const rows = normalizedPageId
    ? (db.prepare("SELECT * FROM repo_sources WHERE page_id = ? ORDER BY display_name ASC").all(normalizedPageId) as SourceRow[])
    : (db.prepare("SELECT * FROM repo_sources ORDER BY display_name ASC").all() as SourceRow[]);

  return rows.map(mapRow);
}

export function listEnabledRepoSourcesWithTokens(pageId = DEFAULT_CHANGELOG_PAGE_ID): RepoSourceWithToken[] {
  const rows = db
    .prepare("SELECT * FROM repo_sources WHERE enabled = 1 AND page_id = ? ORDER BY display_name ASC")
    .all(pageId) as SourceRow[];

  return rows.map(mapRowWithToken);
}

export function createRepoSource(input: SourceCreateInput): RepoSource {
  const nowIso = new Date().toISOString();
  const id = randomUUID();

  getPageOrThrow(input.pageId);

  db.prepare(
    `
      INSERT INTO repo_sources (
        id,
        page_id,
        display_name,
        provider,
        owner,
        repo,
        base_url,
        is_private,
        token_encrypted,
        enabled,
        releases_limit,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @page_id,
        @display_name,
        @provider,
        @owner,
        @repo,
        @base_url,
        @is_private,
        @token_encrypted,
        @enabled,
        @releases_limit,
        @created_at,
        @updated_at
      )
    `
  ).run({
    id,
    page_id: input.pageId,
    display_name: input.displayName,
    provider: input.provider,
    owner: input.owner,
    repo: input.repo,
    base_url: normalizeBaseUrl(input.baseUrl),
    is_private: input.isPrivate ? 1 : 0,
    token_encrypted: encryptToken(input.token),
    enabled: input.enabled ? 1 : 0,
    releases_limit: input.releasesLimit,
    created_at: nowIso,
    updated_at: nowIso
  });

  const row = db.prepare("SELECT * FROM repo_sources WHERE id = ?").get(id) as SourceRow;
  return mapRow(row);
}

export function updateRepoSource(input: SourceUpdateInput): RepoSource {
  const nowIso = new Date().toISOString();

  const current = db.prepare("SELECT * FROM repo_sources WHERE id = ?").get(input.id) as SourceRow | undefined;
  if (!current) {
    throw new Error("Source not found");
  }

  getPageOrThrow(input.pageId);

  const nextToken = input.token === undefined ? current.token_encrypted : encryptToken(input.token);

  db.prepare(
    `
      UPDATE repo_sources
      SET
        page_id = @page_id,
        display_name = @display_name,
        provider = @provider,
        owner = @owner,
        repo = @repo,
        base_url = @base_url,
        is_private = @is_private,
        token_encrypted = @token_encrypted,
        enabled = @enabled,
        releases_limit = @releases_limit,
        updated_at = @updated_at
      WHERE id = @id
    `
  ).run({
    id: input.id,
    page_id: input.pageId,
    display_name: input.displayName,
    provider: input.provider,
    owner: input.owner,
    repo: input.repo,
    base_url: normalizeBaseUrl(input.baseUrl),
    is_private: input.isPrivate ? 1 : 0,
    token_encrypted: nextToken,
    enabled: input.enabled ? 1 : 0,
    releases_limit: input.releasesLimit,
    updated_at: nowIso
  });

  const row = db.prepare("SELECT * FROM repo_sources WHERE id = ?").get(input.id) as SourceRow;
  return mapRow(row);
}

export function deleteRepoSource(id: string): void {
  db.prepare("DELETE FROM repo_sources WHERE id = ?").run(id);
}

export function getAppSettings(): AppSettings {
  const row = db.prepare("SELECT * FROM app_settings WHERE id = 1").get() as AppSettingsRow | undefined;

  if (!row) {
    const updatedAt = new Date().toISOString();
    db.prepare("INSERT INTO app_settings (id, root_page, updated_at) VALUES (1, 'landing', ?)").run(updatedAt);
    return {
      rootPage: "landing",
      updatedAt
    };
  }

  return {
    rootPage: row.root_page,
    updatedAt: row.updated_at
  };
}

export function setRootPageMode(rootPage: RootPageMode): AppSettings {
  const updatedAt = new Date().toISOString();

  db.prepare(
    `
      UPDATE app_settings
      SET root_page = @root_page, updated_at = @updated_at
      WHERE id = 1
    `
  ).run({
    root_page: rootPage,
    updated_at: updatedAt
  });

  return {
    rootPage,
    updatedAt
  };
}

export function getChangelogSnapshot(pageId = DEFAULT_CHANGELOG_PAGE_ID): UnifiedChangelog | null {
  const row = db.prepare("SELECT * FROM changelog_snapshots WHERE page_id = ?").get(pageId) as ChangelogSnapshotRow | undefined;
  if (!row) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.payload_json) as Partial<UnifiedChangelog>;
    if (!parsed || !Array.isArray(parsed.releases) || !Array.isArray(parsed.errors)) {
      return null;
    }

    return {
      fetchedAt: typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : row.fetched_at,
      releases: parsed.releases,
      errors: parsed.errors
    };
  } catch {
    return null;
  }
}

export function saveChangelogSnapshot(pageId: string, payload: UnifiedChangelog): void {
  const nowIso = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO changelog_snapshots (page_id, fetched_at, payload_json, updated_at)
      VALUES (@page_id, @fetched_at, @payload_json, @updated_at)
      ON CONFLICT(page_id) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `
  ).run({
    page_id: pageId,
    fetched_at: payload.fetchedAt,
    payload_json: JSON.stringify(payload),
    updated_at: nowIso
  });
}
