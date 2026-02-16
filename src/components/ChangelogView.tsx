import Link from "next/link";
import { DEFAULT_CHANGELOG_PATH_NAME, listChangelogPages } from "@/lib/db";
import { getUnifiedChangelog } from "@/lib/changelog";
import { ReleaseFeed } from "@/components/ReleaseFeed";

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

  return (
    <main className="page-shell">
      <div className="changelog-topbar">
        <Link href="/admin" className="primary-btn">
          Configure Sources
        </Link>
        <Link href="/" className="ghost-btn">
          Home
        </Link>
        <a href={apiHref} className="ghost-btn" target="_blank" rel="noreferrer">
          JSON API
        </a>
      </div>

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

      <div className="meta-line" style={{ marginBottom: "0.65rem" }}>
        <span>{pageName}</span>
        <span>Path: /{pagePathName}</span>
      </div>

      <ReleaseFeed releases={changelog.releases} errors={changelog.errors} fetchedAt={changelog.fetchedAt} />
    </main>
  );
}
