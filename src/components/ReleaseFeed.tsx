"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import clsx from "clsx";
import type { AggregatedRelease, SourceFetchError } from "@/lib/types";

interface ReleaseFeedProps {
  releases: AggregatedRelease[];
  errors: SourceFetchError[];
  fetchedAt: string;
}

interface MonthBucket {
  key: string;
  label: string;
  shortLabel: string;
  sortDate: number;
}

function getMonthBucket(value: string): MonthBucket {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      key: "unknown",
      label: "Unknown Month",
      shortLabel: "Unknown",
      sortDate: Number.NEGATIVE_INFINITY
    };
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  const shortLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC"
  }).format(date);

  return {
    key,
    label,
    shortLabel,
    sortDate: Date.UTC(year, month - 1, 1)
  };
}

function toShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return format(date, "MMM dd, yyyy");
}

function toReleaseAnchor(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `release-${slug || "item"}`;
}

function providerLabel(provider: AggregatedRelease["provider"]): string {
  if (provider === "gitlab") {
    return "GitLab";
  }

  if (provider === "bitbucket") {
    return "Bitbucket";
  }

  if (provider === "gitea") {
    return "Gitea";
  }

  return "GitHub";
}

export function ReleaseFeed({ releases, errors, fetchedAt }: ReleaseFeedProps): JSX.Element {
  const services = useMemo(() => {
    return Array.from(new Set(releases.map((release) => release.sourceName))).sort((a, b) => a.localeCompare(b));
  }, [releases]);

  const [selectedService, setSelectedService] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [selectedRelease, setSelectedRelease] = useState<AggregatedRelease | null>(null);
  const [activeReleaseId, setActiveReleaseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return releases.filter((release) => {
      const serviceMatch = selectedService === "all" || release.sourceName === selectedService;
      if (!serviceMatch) {
        return false;
      }

      if (!lowerQuery) {
        return true;
      }

      const combined = `${release.sourceName} ${release.name} ${release.tagName} ${release.bodyExcerpt}`.toLowerCase();
      return combined.includes(lowerQuery);
    });
  }, [releases, query, selectedService]);

  const groupedByMonth = useMemo(() => {
    const buckets = new Map<string, MonthBucket & { releases: AggregatedRelease[] }>();

    for (const release of filtered) {
      const { key, label, shortLabel, sortDate } = getMonthBucket(release.publishedAt);

      if (!buckets.has(key)) {
        buckets.set(key, { key, label, shortLabel, sortDate, releases: [] });
      }

      buckets.get(key)?.releases.push(release);
    }

    const groups = Array.from(buckets.values())
      .sort((a, b) => b.sortDate - a.sortDate)
      .map((group) => {
        const releases = [...group.releases].sort((a, b) => {
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
        return {
          key: group.key,
          label: group.label,
          shortLabel: group.shortLabel,
          releases
        };
      });

    return groups;
  }, [filtered]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setSelectedRelease(null);
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const filteredIds = new Set(filtered.map((release) => release.id));
    if (activeReleaseId && !filteredIds.has(activeReleaseId)) {
      setActiveReleaseId(null);
    }

    if (selectedRelease && !filteredIds.has(selectedRelease.id)) {
      setSelectedRelease(null);
    }
  }, [activeReleaseId, filtered, selectedRelease]);

  return (
    <section className="release-feed" aria-label="Unified changelog feed">
      <div className="toolbar">
        <label className="search-box" htmlFor="search-input">
          <span>Search updates</span>
          <input
            id="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by service, version, or release notes"
          />
        </label>

        <div className="service-pills">
          <button
            type="button"
            className={clsx("pill", selectedService === "all" && "active")}
            onClick={() => setSelectedService("all")}
          >
            All Services
          </button>
          {services.map((service) => {
            return (
              <button
                key={service}
                type="button"
                className={clsx("pill", selectedService === service && "active")}
                onClick={() => setSelectedService(service)}
              >
                {service}
              </button>
            );
          })}
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="error-panel" role="status" aria-live="polite">
          <h3>Some sources failed to sync</h3>
          <ul>
            {errors.map((error) => {
              return (
                <li key={`${error.sourceId}:${error.message}`}>
                  <strong>{error.sourceName}</strong> ({error.repository}): {error.message}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="meta-line">
        <span>
          {filtered.length} releases in {groupedByMonth.length} month{groupedByMonth.length === 1 ? "" : "s"}
        </span>
        <span>Last fetched: {toShortDate(fetchedAt)}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No releases matched this filter.</div>
      ) : (
        <div className="timeline-layout">
          <aside className="timeline-sidebar" aria-label="Timeline navigation">
            {groupedByMonth.map((monthGroup) => {
              return (
                <section key={`sidebar-${monthGroup.key}`} className="timeline-sidebar-group">
                  <a href={`#month-${monthGroup.key}`} className="timeline-sidebar-month">
                    <span>{monthGroup.shortLabel}</span>
                  </a>

                  <ul className="timeline-sidebar-list">
                    {monthGroup.releases.map((release) => {
                      const releaseAnchor = toReleaseAnchor(release.id);
                      return (
                        <li key={`sidebar-${release.id}`}>
                          <a
                            href={`#${releaseAnchor}`}
                            className={clsx(activeReleaseId === release.id && "active")}
                            onClick={() => setActiveReleaseId(release.id)}
                          >
                            {release.name || release.tagName}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </aside>

          <div className="release-timeline">
            {groupedByMonth.map((monthGroup) => {
              return (
                <section key={monthGroup.key} id={`month-${monthGroup.key}`} className="month-group">
                  <header className="month-group-header">
                    <h3>{monthGroup.label}</h3>
                    <span>{monthGroup.releases.length} updates</span>
                  </header>

                  <div className="month-group-items">
                    {monthGroup.releases.map((release) => {
                      const releaseAnchor = toReleaseAnchor(release.id);
                      return (
                        <article
                          key={release.id}
                          id={releaseAnchor}
                          className={clsx("timeline-item", activeReleaseId === release.id && "selected")}
                        >
                          <aside className="timeline-stamp">
                            <time dateTime={release.publishedAt}>{toShortDate(release.publishedAt)}</time>
                            <span>{release.sourceName}</span>
                          </aside>

                          <div className="timeline-node" aria-hidden="true">
                            <span className="timeline-dot" />
                          </div>

                          <div className="timeline-content">
                            <article
                              className="release-card timeline-card clickable-card"
                              role="button"
                              tabIndex={0}
                              aria-label={`View details for ${release.name || release.tagName}`}
                              onClick={() => {
                                setActiveReleaseId(release.id);
                                setSelectedRelease(release);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setActiveReleaseId(release.id);
                                  setSelectedRelease(release);
                                }
                              }}
                            >
                              <header className="card-header">
                                <span className="service-chip">{release.sourceName}</span>
                                <time dateTime={release.publishedAt}>{toShortDate(release.publishedAt)}</time>
                              </header>

                              <h3>{release.name}</h3>

                              <div className="version-line">
                                <span>{release.repository}</span>
                                <span>{release.tagName}</span>
                              </div>

                              {release.bodyExcerpt ? (
                                <p className="release-excerpt">{release.bodyExcerpt}</p>
                              ) : (
                                <p className="release-excerpt">No release notes were provided for this version.</p>
                              )}

                              <footer className="card-footer">
                                <div className="flags">
                                  {release.kind === "commit" ? <span className="flag">From commit</span> : null}
                                  {release.prerelease ? <span className="flag">Pre-release</span> : null}
                                  {release.draft ? <span className="flag">Draft</span> : null}
                                </div>

                                <div className="card-actions">
                                  <button
                                    type="button"
                                    className="mini-btn"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActiveReleaseId(release.id);
                                      setSelectedRelease(release);
                                    }}
                                  >
                                    View details
                                  </button>
                                  <a
                                    href={release.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    onFocus={() => setActiveReleaseId(release.id)}
                                  >
                                    Open on {providerLabel(release.provider)}
                                  </a>
                                </div>
                              </footer>
                            </article>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {selectedRelease ? (
        <div className="release-modal-backdrop" onClick={() => setSelectedRelease(null)}>
          <article
            className="release-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="release-modal-header">
              <div>
                <p className="eyebrow modal-eyebrow">{selectedRelease.sourceName}</p>
                <h3 id="release-modal-title">{selectedRelease.name}</h3>
                <p className="release-modal-meta">
                  {selectedRelease.repository} · {selectedRelease.kind === "commit" ? "commit" : "release"} ·{" "}
                  {selectedRelease.tagName} · {toShortDate(selectedRelease.publishedAt)}
                </p>
              </div>
              <button
                type="button"
                className="mini-btn icon-btn"
                aria-label="Close release details"
                onClick={() => setSelectedRelease(null)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="release-modal-body">
              <pre>{selectedRelease.body || "No detailed release notes provided."}</pre>
            </div>

            <footer className="release-modal-footer">
              <a href={selectedRelease.htmlUrl} target="_blank" rel="noreferrer">
                View original update on {providerLabel(selectedRelease.provider)}
              </a>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
}
