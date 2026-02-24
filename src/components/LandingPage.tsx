import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";

import { GitMerge, Lock, Globe } from "react-feather";

const FEATURES = [
  {
    icon: <GitMerge size={20} />,
    title: "Cross-service intelligence",
    desc: "Normalize releases and commit streams from every repo into a single product changelog that stays coherent over time.",
  },
  {
    icon: <Lock size={20} />,
    title: "Private-repo ready",
    desc: "Use scoped tokens per source, keep credentials secured, and rotate safely without redeploying the application.",
  },
  {
    icon: <Globe size={20} />,
    title: "Publish everywhere",
    desc: "Serve the same changelog to humans and systems with timeline browsing, stable anchors, and a protected API.",
  },
];

const PROVIDERS = [
  { name: "GitHub", icon: "⬡" },
  { name: "GitLab", icon: "◆" },
  { name: "Bitbucket", icon: "◈" },
  { name: "Gitea", icon: "◎" },
];

export async function LandingPage(): Promise<JSX.Element> {
  const isAdmin = await isAdminAuthenticated();

  return (
    <main className="page-shell landing-shell">
      <section className="landing-topbar" style={{ animation: "fadeIn 500ms ease both" }}>
        <p className="landing-brand">⬢ Releaseboard</p>
        <div className="hero-actions">
          <a href="https://github.com/PipeOpsHQ/releaseboard" target="_blank" rel="noreferrer" className="ghost-btn" style={{ marginRight: "0.5rem" }}>
            GitHub
          </a>
          <Link href="/docs" className="ghost-btn" style={{ marginRight: "0.5rem" }}>
            Docs
          </Link>
          <a href="https://www.pipeops.io/addons/c7b3fa6c-a9a3-4974-95d2-2ba39a1777b1/details" target="_blank" rel="noreferrer" className="ghost-btn">
            Deploy on PipeOps
          </a>
          <Link href="/changelog" className="primary-btn">
            Open Live Feed
          </Link>
        </div>
      </section>

      <section className="landing-hero-panel" style={{ animation: "fadeSlideUp 600ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "100ms" }}>
        <div className="landing-hero">
          <p className="eyebrow">Unified Product Updates</p>
          <h1 className="gradient-text">
            One changelog surface for every service your product depends on.
          </h1>
          <p className="hero-copy">
            Aggregate releases and commits from GitHub, GitLab, Bitbucket, and
            Gitea — including private repos — and ship one polished changelog
            your users can trust.
          </p>

          <div className="hero-actions" style={{ marginTop: "0.2rem" }}>
            {PROVIDERS.map((p, i) => (
              <span key={p.name} className="pill" style={{ cursor: "default", fontSize: "0.8rem", animation: "fadeSlideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: `${200 + i * 50}ms` }}>
                <span style={{ opacity: 0.6, marginRight: "4px" }}>{p.icon}</span> {p.name}
              </span>
            ))}
          </div>

          <div className="hero-actions" style={{ marginTop: "1rem" }}>
            <Link href="/changelog" className="primary-btn">
              View Changelog
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="ghost-btn">
                Configure Sources
              </Link>
            ) : (
              <Link href="/docs" className="ghost-btn">
                Read Documentation
              </Link>
            )}
          </div>
        </div>

        <aside className="landing-console" aria-label="Changelog flow preview">
          <div className="console-header">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <p className="console-typing typing-cmd">releaseboard aggregate</p>
          </div>
          <div className="console-body">
            <p className="console-typing typing-line-1">
              <span className="accent">[sync]</span> Attached <strong>pipeopshq/agent</strong> (private)
            </p>
            <p className="console-typing typing-line-2">
              <span className="accent">[fetch]</span> 8 releases, 24 commits ingested
            </p>
            <p className="console-typing typing-line-3">
              <span className="accent">[render]</span> Unified feed built at <strong>/changelog</strong>
            </p>
            <div className="console-tags">
              <span>Release notes</span>
              <span>Commit inferred</span>
              <span>Per-service filter</span>
              <span>Details modal</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="landing-grid">
        {FEATURES.map((f, i) => (
          <article className="landing-card" key={f.title} style={{ animation: "fadeSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: `${300 + i * 100}ms` }}>
            <h3>
              <span style={{ marginRight: "0.6rem", fontSize: "1.2rem", opacity: 0.8 }}>{f.icon}</span>
              {f.title}
            </h3>
            <p>{f.desc}</p>
          </article>
        ))}
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--surface-border)",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          animation: "fadeIn 500ms ease both",
          animationDelay: "600ms"
        }}
      >
        <span>© {new Date().getFullYear()} Releaseboard</span>
        <div style={{ display: "flex", gap: "1.2rem", fontWeight: 500 }}>
          {isAdmin && <Link href="/admin">Admin</Link>}
          <Link href="/docs">Docs</Link>
          <Link href="/changelog">Changelog</Link>
          <a href="/api/changelog" target="_blank" rel="noreferrer">
            API
          </a>
        </div>
      </footer>
    </main>
  );
}
