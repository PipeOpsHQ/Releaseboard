import {
  DEFAULT_CHANGELOG_PAGE_ID,
  getChangelogSnapshot,
  listEnabledRepoSourcesWithTokens,
  saveChangelogSnapshot
} from "@/lib/db";
import { fetchReleasesForSource } from "@/lib/github";
import type { SourceFetchError, UnifiedChangelog } from "@/lib/types";

const CACHE_WINDOW_MS = 1000 * 60 * 3;

const cache = new Map<
  string,
  {
    until: number;
    payload: UnifiedChangelog;
  }
>();

export function invalidateChangelogCache(pageId?: string): void {
  if (pageId) {
    cache.delete(pageId);
    return;
  }

  cache.clear();
}

export async function getUnifiedChangelog(options?: { forceRefresh?: boolean; pageId?: string }): Promise<UnifiedChangelog> {
  const pageId = options?.pageId ?? DEFAULT_CHANGELOG_PAGE_ID;
  const shouldUseCache = !options?.forceRefresh;
  const cached = cache.get(pageId);

  if (shouldUseCache && cached && Date.now() < cached.until) {
    return cached.payload;
  }

  const persistedSnapshot = getChangelogSnapshot(pageId);
  if (shouldUseCache && persistedSnapshot) {
    const snapshotAgeMs = Date.now() - new Date(persistedSnapshot.fetchedAt).getTime();
    if (snapshotAgeMs >= 0 && snapshotAgeMs < CACHE_WINDOW_MS) {
      cache.set(pageId, {
        until: Date.now() + CACHE_WINDOW_MS,
        payload: persistedSnapshot
      });
      return persistedSnapshot;
    }
  }

  const sources = listEnabledRepoSourcesWithTokens(pageId);
  const errors: SourceFetchError[] = [];

  const results = await Promise.all(
    sources.map(async (source) => {
      const result = await fetchReleasesForSource(source);
      if (result.error) {
        errors.push({
          sourceId: source.id,
          sourceName: source.displayName,
          repository: `${source.owner}/${source.repo}`,
          message: result.error
        });
      }
      return result.releases;
    })
  );

  const releases = results.flat().sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const payload: UnifiedChangelog = {
    fetchedAt: new Date().toISOString(),
    releases,
    errors
  };

  if (payload.releases.length === 0 && payload.errors.length > 0 && persistedSnapshot?.releases.length) {
    const fallbackPayload: UnifiedChangelog = {
      ...persistedSnapshot,
      errors: payload.errors
    };

    cache.set(pageId, {
      until: Date.now() + CACHE_WINDOW_MS,
      payload: fallbackPayload
    });

    return fallbackPayload;
  }

  saveChangelogSnapshot(pageId, payload);

  cache.set(pageId, {
    until: Date.now() + CACHE_WINDOW_MS,
    payload
  });

  return payload;
}
