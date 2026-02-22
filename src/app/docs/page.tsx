import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { Lock, Server, Shield, Zap } from "react-feather";

export default async function DocsPage(): Promise<JSX.Element> {
  const isAdmin = await isAdminAuthenticated();

  return (
    <main className="page-shell">
      <nav className="changelog-topbar" style={{ alignItems: "center" }}>
        <Link
          href="/"
          className="landing-brand"
          style={{ fontSize: "0.85rem", textDecoration: "none" }}
        >
          ⬢ Releaseboard
        </Link>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginLeft: "auto" }}>
          <Link href="/" className="ghost-btn">
            Home
          </Link>
          <Link href="/changelog" className="ghost-btn">
            Changelog
          </Link>
          {isAdmin && (
            <Link href="/admin" className="ghost-btn">
              Admin
            </Link>
          )}
        </div>
      </nav>

      <div className="meta-line" style={{ marginBottom: "2rem" }}>
        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Documentation</span>
        <span>/architecture-and-privacy</span>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "4rem" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "1.5rem", color: "var(--text-primary)" }}>
          How it Works
        </h1>

        <p style={{ fontSize: "1.1rem", lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: "3rem" }}>
          Releaseboard is designed with simplicity, speed, and privacy in mind. We believe your infrastructure data should remain yours. Here is an overview of the technology and our data privacy guarantees.
        </p>

        <section style={{ marginBottom: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "1rem" }}>
            <Shield color="var(--accent-green)" />
            <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Data Privacy & Security</h2>
          </div>
          <div className="landing-card" style={{ padding: "1.5rem", textAlign: "left", flex: "none" }}>
            <p style={{ marginBottom: "1rem" }}>
              <strong>We do not send your data anywhere.</strong> Releaseboard acts as a direct conduit between your Git providers (GitHub, GitLab, Bitbucket, Gitea) and the users viewing the changelog.
            </p>
            <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <li style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent-red)" }}>•</span>
                <span><strong>No Telemetry:</strong> There is absolutely no third-party tracking, analytics, or phone-home telemetry.</span>
              </li>
              <li style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent-red)" }}>•</span>
                <span><strong>Local SQLite Storage:</strong> Source configurations, credentials, and API response caches are stored entirely within a local SQLite database (<code>changelog.db</code>) on your server.</span>
              </li>
              <li style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent-red)" }}>•</span>
                <span><strong>Direct Proxying:</strong> We fetch release data directly from your configured repositories on demand (with a short cache window) and render it server-side. The data only travels from your Git provider → your Releaseboard server → your user's browser.</span>
              </li>
            </ul>
          </div>
        </section>

        <section style={{ marginBottom: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "1rem" }}>
            <Zap color="var(--accent-yellow)" />
            <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Technology Stack</h2>
          </div>
          <div className="landing-card" style={{ padding: "1.5rem", textAlign: "left", flex: "none" }}>
            <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
              <li>
                <strong>Next.js 15 (App Router):</strong> The core framework powering both the frontend and backend API capabilities. We utilize React Server Components for heavy lifting to ship virtually zero JavaScript to the client.
              </li>
              <li>
                <strong>Better-SQLite3:</strong> A fast, synchronous SQLite driver for Node.js. Used to store your configured sources and provide a local caching layer so we don't hit rate limits on your Git providers.
              </li>
              <li>
                <strong>Vanilla CSS & CSS Variables:</strong> We bypass heavy styling libraries in favor of a lean, performant CSS architecture utilizing modern variables and native media queries for our dark-mode glassmorphism aesthetic.
              </li>
              <li>
                <strong>Docker:</strong> Containerized for immediate deployment on any platform utilizing a multi-stage Alpine Node build to keep the image size minimal.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "1rem" }}>
            <Server color="var(--accent-blue)" />
            <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Release Inference</h2>
          </div>
          <div className="landing-card" style={{ padding: "1.5rem", textAlign: "left", flex: "none" }}>
            <p style={{ marginBottom: "1rem" }}>
              Releaseboard supports aggregating standardized releases and tags. But what about repositories that don't use formal releases?
            </p>
            <p>
              We built a <strong>Commit Fallback</strong> engine. If a repository has zero formal releases, the engine automatically falls back to querying the commit history of the main branch. It seamlessly infers the updates by parsing the commit messages, so your changelog always has content, regardless of the repository's CI/CD maturity.
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
