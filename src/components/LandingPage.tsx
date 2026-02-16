import Link from "next/link";
import { getPipeOpsSignInUrl } from "@/lib/pipeops-auth";

export function LandingPage(): JSX.Element {
  const pipeOpsSignInUrl = getPipeOpsSignInUrl("/");

  return (
    <main className="page-shell landing-shell">
      <section className="landing-topbar">
        <p className="landing-brand">Releaseboard</p>
        <div className="hero-actions">
          <a href={pipeOpsSignInUrl} className="ghost-btn">
            Sign in with PipeOps
          </a>
          <Link href="/changelog" className="ghost-btn">
            Open Live Feed
          </Link>
        </div>
      </section>

      <section className="landing-hero-panel">
        <div className="landing-hero">
          <p className="eyebrow">Unified Product Updates</p>
          <h1>One changelog surface for every service your product depends on.</h1>
          <p className="hero-copy">
            Aggregate releases and commits from GitHub, GitLab, Bitbucket, and Gitea, including private repos, and
            ship one polished changelog your users can trust.
          </p>

          <div className="hero-actions">
            <Link href="/changelog" className="primary-btn">
              View Changelog
            </Link>
            <Link href="/admin" className="ghost-btn">
              Configure Sources
            </Link>
          </div>
        </div>

        <aside className="landing-console" aria-label="Changelog flow preview">
          <div className="console-header">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <p className="console-typing typing-cmd">releaseboard/changelog.aggregate</p>
          </div>
          <div className="console-body">
            <p className="console-typing typing-line-1">
              <span className="accent">[sync]</span> Added <strong>pipeopshq/agent</strong> (private token enabled)
            </p>
            <p className="console-typing typing-line-2">
              <span className="accent">[fetch]</span> 8 releases + 24 commits collected
            </p>
            <p className="console-typing typing-line-3">
              <span className="accent">[render]</span> Published unified feed at <strong>/changelog</strong>
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
        <article className="landing-card">
          <h3>Cross-service release intelligence</h3>
          <p>Normalize releases and commit streams from every repo into a single product changelog that stays coherent over time.</p>
        </article>
        <article className="landing-card">
          <h3>Private-repo ready</h3>
          <p>Use scoped tokens per source, keep credentials in admin, and rotate safely without redeploying the app.</p>
        </article>
        <article className="landing-card">
          <h3>Publish once, distribute anywhere</h3>
          <p>Serve the same changelog to humans and systems with timeline browsing, stable anchors, and a protected API endpoint.</p>
        </article>
      </section>
    </main>
  );
}
