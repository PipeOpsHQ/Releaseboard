"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { AggregatedRelease, SourceFetchError } from "@/lib/types";

interface ReleaseFeedProps {
  releases: AggregatedRelease[];
  errors: SourceFetchError[];
  fetchedAt: string;
  sourceNames?: string[];
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
    return { key: "unknown", label: "Unknown Month", shortLabel: "Unknown", sortDate: Number.NEGATIVE_INFINITY };
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const shortLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return { key, label, shortLabel, sortDate: Date.UTC(year, month - 1, 1) };
}

function toShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return format(date, "MMM dd, yyyy");
}

function toReleaseAnchor(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `release-${slug || "item"}`;
}

function providerLabel(provider: AggregatedRelease["provider"]): string {
  if (provider === "gitlab") return "GitLab";
  if (provider === "bitbucket") return "Bitbucket";
  if (provider === "gitea") return "Gitea";
  return "GitHub";
}

export function ReleaseFeed({ releases, errors, fetchedAt, sourceNames }: ReleaseFeedProps): JSX.Element {
  const services = useMemo(() => {
    if (sourceNames && sourceNames.length > 0) {
      const active = new Set(releases.map((r) => r.sourceName));
      return sourceNames.filter(name => active.has(name));
    }
    return Array.from(new Set(releases.map((r) => r.sourceName))).sort((a, b) => a.localeCompare(b));
  }, [releases, sourceNames]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const serviceFromUrl = searchParams.get("service") ?? "all";

  // Keep local state in sync or just map directly to the URL.
  // Mapping directly to the URL is cleaner.
  const selectedService = services.includes(serviceFromUrl) ? serviceFromUrl : "all";

  const setServiceFilter = (serviceName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (serviceName === "all") {
      params.delete("service");
    } else {
      params.set("service", serviceName);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [query, setQuery] = useState<string>("");
  const [selectedRelease, setSelectedRelease] = useState<AggregatedRelease | null>(null);
  const [activeReleaseId, setActiveReleaseId] = useState<string | null>(null);
  const [dismissedErrors, setDismissedErrors] = useState(false);

  const filtered = useMemo(() => {
    const lq = query.trim().toLowerCase();
    return releases.filter((r) => {
      if (selectedService !== "all" && r.sourceName !== selectedService) return false;
      if (!lq) return true;
      return `${r.sourceName} ${r.name} ${r.tagName} ${r.bodyExcerpt}`.toLowerCase().includes(lq);
    });
  }, [releases, query, selectedService]);

  const groupedByMonth = useMemo(() => {
    const buckets = new Map<string, MonthBucket & { releases: AggregatedRelease[] }>();
    for (const r of filtered) {
      const { key, label, shortLabel, sortDate } = getMonthBucket(r.publishedAt);
      if (!buckets.has(key)) buckets.set(key, { key, label, shortLabel, sortDate, releases: [] });
      buckets.get(key)?.releases.push(r);
    }
    return Array.from(buckets.values())
      .sort((a, b) => b.sortDate - a.sortDate)
      .map((g) => ({
        key: g.key,
        label: g.label,
        shortLabel: g.shortLabel,
        releases: [...g.releases].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      }));
  }, [filtered]);

  useEffect(() => {
    function onEscape(e: KeyboardEvent): void {
      if (e.key === "Escape") setSelectedRelease(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  useEffect(() => {
    const ids = new Set(filtered.map((r) => r.id));
    if (activeReleaseId && !ids.has(activeReleaseId)) setActiveReleaseId(null);
    if (selectedRelease && !ids.has(selectedRelease.id)) setSelectedRelease(null);
  }, [activeReleaseId, filtered, selectedRelease]);

  return (
    <section className="release-feed" aria-label="Unified changelog feed">
      <div className="toolbar">
        <label className="search-box" htmlFor="search-input">
          <span>Search updates</span>
          <div style={{ position: "relative" }}>
            <input
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by service, version, or release notes…"
              style={{ paddingRight: "3.5rem" }}
            />
            <kbd
              style={{
                position: "absolute",
                right: "0.8rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                pointerEvents: "none",
                fontFamily: "var(--font-mono)"
              }}
            >
              ⌘K
            </kbd>
          </div>
        </label>

        <div className="service-pills">
          <button
            type="button"
            className={clsx("pill", selectedService === "all" && "active")}
            onClick={() => setServiceFilter("all")}
          >
            All Services
          </button>
          {services.map((s) => (
            <button
              key={s}
              type="button"
              className={clsx("pill", selectedService === s && "active")}
              onClick={() => setServiceFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {!dismissedErrors && errors.length > 0 ? (
        <div className="error-panel" role="status" aria-live="polite" style={{ position: "relative" }}>
          <button
            type="button"
            className="mini-btn icon-btn"
            aria-label="Dismiss errors"
            onClick={() => setDismissedErrors(true)}
            style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16} style={{ stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
              <path d="M6 6L18 18M18 6L6 18" />
            </svg>
          </button>
          <div style={{ paddingRight: "2rem" }}>
            <h3 style={{ marginTop: 0 }}>⚠ Some sources failed to sync</h3>
            <ul>
              {errors.map((err) => (
                <li key={`${err.sourceId}:${err.message}`}>
                  <strong>{err.sourceName}</strong> ({err.repository}): {err.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="meta-line">
        <span>
          {filtered.length} release{filtered.length !== 1 ? "s" : ""} in {groupedByMonth.length} month
          {groupedByMonth.length === 1 ? "" : "s"}
        </span>
        <span>Last fetched: {toShortDate(fetchedAt)}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No releases matched this filter.</div>
      ) : (
        <div className="timeline-layout">
          <aside className="timeline-sidebar" aria-label="Timeline navigation">
            {groupedByMonth.map((mg) => (
              <section key={`sidebar-${mg.key}`} className="timeline-sidebar-group">
                <a href={`#month-${mg.key}`} className="timeline-sidebar-month">
                  <span>{mg.shortLabel}</span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      marginLeft: "auto",
                      opacity: 0.7,
                    }}
                  >
                    {mg.releases.length}
                  </span>
                </a>
                <ul className="timeline-sidebar-list">
                  {mg.releases.map((r) => {
                    const anchor = toReleaseAnchor(r.id);
                    return (
                      <li key={`sidebar-${r.id}`}>
                        <a
                          href={`#${anchor}`}
                          className={clsx(activeReleaseId === r.id && "active")}
                          onClick={() => setActiveReleaseId(r.id)}
                        >
                          {r.name || r.tagName}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </aside>

          <div className="release-timeline">
            {groupedByMonth.map((mg) => (
              <section key={mg.key} id={`month-${mg.key}`} className="month-group">
                <header className="month-group-header">
                  <h3>{mg.label}</h3>
                  <span>{mg.releases.length} updates</span>
                </header>

                <div className="month-group-items">
                  {mg.releases.map((r, idx) => {
                    const anchor = toReleaseAnchor(r.id);
                    return (
                      <article
                        key={r.id}
                        id={anchor}
                        className={clsx("timeline-item", activeReleaseId === r.id && "selected")}
                        style={{ animationDelay: `${Math.min(idx * 40, 300)}ms` }}
                      >
                        <aside className="timeline-stamp">
                          <time dateTime={r.publishedAt}>{toShortDate(r.publishedAt)}</time>
                          <span>{r.sourceName}</span>
                        </aside>

                        <div className="timeline-node" aria-hidden="true">
                          <span className="timeline-dot" />
                        </div>

                        <div className="timeline-content">
                          <article
                            className="release-card timeline-card clickable-card"
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for ${r.name || r.tagName}`}
                            onClick={() => {
                              setActiveReleaseId(r.id);
                              setSelectedRelease(r);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActiveReleaseId(r.id);
                                setSelectedRelease(r);
                              }
                            }}
                          >
                            <header className="card-header">
                              <span className="service-chip">{r.sourceName}</span>
                              <time dateTime={r.publishedAt}>{toShortDate(r.publishedAt)}</time>
                            </header>

                            <h3>{r.name}</h3>

                            <div className="version-line">
                              <span>{r.repository}</span>
                              <span>{r.tagName}</span>
                            </div>

                            {r.bodyExcerpt ? (
                              <p className="release-excerpt">{r.bodyExcerpt}</p>
                            ) : (
                              <p className="release-excerpt" style={{ fontStyle: "italic", opacity: 0.7 }}>
                                No release notes were provided for this version.
                              </p>
                            )}

                            <footer className="card-footer">
                              <div className="flags">
                                {r.kind === "commit" ? <span className="flag">From commit</span> : null}
                                {r.prerelease ? <span className="flag">Pre-release</span> : null}
                                {r.draft ? <span className="flag">Draft</span> : null}
                              </div>

                              <div className="card-actions">
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReleaseId(r.id);
                                    setSelectedRelease(r);
                                  }}
                                >
                                  View details
                                </button>
                                <a
                                  href={r.htmlUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={() => setActiveReleaseId(r.id)}
                                >
                                  Open on {providerLabel(r.provider)}
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
            ))}
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
            onClick={(e) => e.stopPropagation()}
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
                View original on {providerLabel(selectedRelease.provider)} →
              </a>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
}
