import Link from "next/link";
import { DEFAULT_CHANGELOG_PATH_NAME, listChangelogPages } from "@/lib/db";
import { getUnifiedChangelog } from "@/lib/changelog";
import { ReleaseFeed } from "@/components/ReleaseFeed";
import { isAdminAuthenticated } from "@/lib/admin-auth";

interface ChangelogViewProps {
  pageId?: string;
  pagePathName?: string;
  pageName?: string;
}

export async function ChangelogView(props?: ChangelogViewProps): Promise<JSX.Element> {
  const pageId = props?.pageId;
  const pagePathName = props?.pagePathName ?? DEFAULT_CHANGELOG_PATH_NAME;
  const pageName = props?.pageName ?? "Changelog";
  const changelog = await getUnifiedChangelog({ pageId });
  const pages = listChangelogPages();
  const apiHref = `/api/changelog?path=${encodeURIComponent(pagePathName)}`;
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
          <Link href="/docs" className="ghost-btn">
            Docs
          </Link>
          <Link href="/" className="ghost-btn">
            Home
          </Link>
          {isAdmin && (
            <Link href="/admin" className="ghost-btn">
              Admin
            </Link>
          )}
          <a href={apiHref} className="ghost-btn" target="_blank" rel="noreferrer">
            JSON API
          </a>
        </div>
      </nav>

      {pages.length > 1 ? (
        <div className="service-pills" style={{ marginBottom: "0.8rem" }}>
          {pages.map((page) => {
            return (
              <Link
                key={page.id}
                href={page.pathName === DEFAULT_CHANGELOG_PATH_NAME ? "/changelog" : `/${page.pathName}`}
                className={`pill ${page.pathName === pagePathName ? "active" : ""}`}
              >
                {page.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="meta-line" style={{ marginBottom: "0.6rem" }}>
        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{pageName}</span>
        <span>/{pagePathName}</span>
      </div>

      <ReleaseFeed releases={changelog.releases} errors={changelog.errors} fetchedAt={changelog.fetchedAt} />
    </main>
  );
}
