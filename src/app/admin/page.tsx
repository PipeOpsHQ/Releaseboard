import Link from "next/link";
import { isAdminAuthenticated, isAdminPasswordConfigured } from "@/lib/admin-auth";
import { DEFAULT_CHANGELOG_PAGE_ID, getAppSettings, listChangelogPages, listRepoSources } from "@/lib/db";
import { getPipeOpsSignInUrl } from "@/lib/pipeops-auth";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import {
  createChangelogPageAction,
  createSourceAction,
  deleteChangelogPageAction,
  deleteSourceAction,
  loginAction,
  logoutAction,
  refreshAction,
  updateChangelogPageAction,
  updateRootPageAction,
  updateSourceAction
} from "@/app/admin/actions";

export default async function AdminPage(): Promise<JSX.Element> {
  const authenticated = await isAdminAuthenticated();
  const hasPassword = isAdminPasswordConfigured();
  const pipeOpsSignInUrl = getPipeOpsSignInUrl("/admin");

  if (!authenticated) {
    return (
      <main className="page-shell admin-shell">
        <header className="admin-header admin-hero">
          <p className="eyebrow">Admin</p>
          <h1>Authenticate to manage changelog pages and sources</h1>
          <p className="hero-copy">Sign in to configure paths, domains, providers, tokens, and public feed behavior.</p>
        </header>

        <section className="admin-card auth-card">
          <form action={loginAction} className="admin-grid">
            <label>
              Admin Password
              <input name="password" type="password" placeholder="Enter ADMIN_PASSWORD" required />
            </label>
            <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Signing In...">
              Sign In
            </FormSubmitButton>
          </form>

          <div className="admin-inline-actions">
            <a href={pipeOpsSignInUrl} className="ghost-btn">
              Sign in with PipeOps
            </a>

            <Link href="/" className="ghost-btn">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const pages = listChangelogPages();
  const sources = listRepoSources();
  const settings = getAppSettings();

  const enabledSources = sources.filter((source) => source.enabled).length;
  const privateSources = sources.filter((source) => source.isPrivate).length;

  return (
    <main className="page-shell admin-shell">
      <header className="admin-header admin-hero">
        <p className="eyebrow">⬢ Admin</p>
        <h1 className="gradient-text">Releaseboard Control Center</h1>
        <p className="admin-hero-kicker">Operate every changelog surface from one place.</p>
        <p className="hero-copy">
          Manage multiple changelog pages, set unique paths/domains, and route repository sources into the right public feed.
        </p>

        <div className="hero-actions">
          <Link href="/changelog" className="ghost-btn">
            Open Default Feed
          </Link>

          <Link href="/" className="ghost-btn">
            Home
          </Link>

          <form action={refreshAction}>
            <FormSubmitButton type="submit" className="ghost-btn" pendingLabel="Refreshing...">
              Refresh Cache
            </FormSubmitButton>
          </form>

          {hasPassword ? (
            <form action={logoutAction}>
              <FormSubmitButton type="submit" className="ghost-btn" pendingLabel="Signing Out...">
                Sign Out
              </FormSubmitButton>
            </form>
          ) : null}
        </div>

        <div className="admin-kpis" role="list" aria-label="Admin overview">
          <article className="admin-kpi" role="listitem" style={{ animation: "fadeSlideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "100ms" }}>
            <span>Pages</span>
            <strong>{pages.length}</strong>
          </article>
          <article className="admin-kpi" role="listitem" style={{ animation: "fadeSlideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "200ms" }}>
            <span>Sources</span>
            <strong>{sources.length}</strong>
          </article>
          <article className="admin-kpi" role="listitem" style={{ animation: "fadeSlideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "300ms" }}>
            <span>Enabled</span>
            <strong>{enabledSources}</strong>
          </article>
          <article className="admin-kpi" role="listitem" style={{ animation: "fadeSlideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "400ms" }}>
            <span>Private</span>
            <strong>{privateSources}</strong>
          </article>
        </div>
      </header>

      {!hasPassword ? (
        <section className="admin-card warning-card">
          <strong>⚠ Security warning:</strong> <code>ADMIN_PASSWORD</code> is not set. Anyone with access to this app can change repo tokens.
        </section>
      ) : null}

      <div className="admin-main-grid">
        <section className="admin-column" style={{ animation: "fadeSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "250ms" }}>
          <section className="admin-card admin-section-card">
            <h2>Display Settings</h2>
            <p className="admin-section-note">Choose what visitors see on `/` by default.</p>
            <form action={updateRootPageAction} className="admin-grid">
              <label>
                Default root page (`/`)
                <select name="rootPage" defaultValue={settings.rootPage}>
                  <option value="landing">Landing page (default)</option>
                  <option value="changelog">Unified changelog feed</option>
                </select>
              </label>
              <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Saving...">
                Save Display Settings
              </FormSubmitButton>
            </form>
          </section>

          <section className="admin-card admin-section-card">
            <h2>Create Changelog Page</h2>
            <p className="admin-section-note">Create a new public changelog feed with its own route and optional domain.</p>
            <form action={createChangelogPageAction} className="admin-grid two-col">
              <label>
                Page Name
                <input name="name" placeholder="Payments Changelog" required />
              </label>

              <label>
                Path Name
                <input name="pathName" placeholder="payments" required />
              </label>

              <label className="full-width">
                Custom Domain (optional)
                <input name="customDomain" placeholder="updates.example.com" />
              </label>

              <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Creating Page...">
                Create Page
              </FormSubmitButton>
            </form>
          </section>

          <section className="admin-list-block">
            <div className="admin-list-header">
              <h2>Changelog Pages</h2>
              <span>{pages.length} total</span>
            </div>

            <section className="admin-list admin-page-list">
              {pages.map((page) => {
                const pageHref = page.pathName === "changelog" ? "/changelog" : `/${page.pathName}`;
                const isDefaultPage = page.id === DEFAULT_CHANGELOG_PAGE_ID;

                return (
                  <article className="admin-card admin-page-card" key={page.id}>
                    <div className="admin-card-top">
                      <div className="admin-title-stack">
                        <h3>{page.name}</h3>
                        <p className="admin-subtle">
                          Path: /{page.pathName}
                          {page.customDomain ? ` • Domain: ${page.customDomain}` : ""}
                        </p>
                      </div>

                      <div className="admin-inline-actions">
                        <Link href={pageHref} className="ghost-btn">
                          Open
                        </Link>

                        {!isDefaultPage ? (
                          <form action={deleteChangelogPageAction} className="inline-form">
                            <input type="hidden" name="id" value={page.id} />
                            <FormSubmitButton type="submit" className="danger-btn" pendingLabel="Deleting Page...">
                              Delete
                            </FormSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <form action={updateChangelogPageAction} className="admin-grid two-col">
                      <input type="hidden" name="id" value={page.id} />

                      <label>
                        Page Name
                        <input name="name" defaultValue={page.name} required />
                      </label>

                      <label>
                        Path Name
                        <input name="pathName" defaultValue={page.pathName} required disabled={isDefaultPage} />
                        {isDefaultPage ? <input type="hidden" name="pathName" value={page.pathName} /> : null}
                      </label>

                      <label className="full-width">
                        Custom Domain (optional)
                        <input name="customDomain" defaultValue={page.customDomain ?? ""} placeholder="updates.example.com" />
                      </label>

                      <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Saving Page...">
                        Save Page
                      </FormSubmitButton>
                    </form>
                  </article>
                );
              })}
            </section>
          </section>
        </section>

        <section className="admin-column" style={{ animation: "fadeSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "350ms" }}>
          <section className="admin-card admin-section-card">
            <h2>Add Repository Source</h2>
            <p className="admin-section-note">Attach repositories across providers and map each one to a target changelog page.</p>
            <form action={createSourceAction} className="admin-grid two-col">
              <label>
                Changelog Page
                <select name="pageId" defaultValue={DEFAULT_CHANGELOG_PAGE_ID}>
                  {pages.map((page) => {
                    return (
                      <option key={page.id} value={page.id}>
                        {page.name} (/{page.pathName})
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Provider
                <select name="provider" defaultValue="github">
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="bitbucket">Bitbucket</option>
                  <option value="gitea">Gitea</option>
                </select>
              </label>

              <label>
                Display Name
                <input name="displayName" placeholder="Gateway API" required />
              </label>

              <label>
                Owner / Org / Workspace
                <input name="owner" placeholder="org-or-workspace" required />
              </label>

              <label>
                Repository
                <input name="repo" placeholder="service-repo" required />
              </label>

              <label>
                Base URL (optional)
                <input name="baseUrl" placeholder="https://gitlab.com or self-hosted URL" />
              </label>

              <label>
                Releases to fetch
                <input name="releasesLimit" type="number" min={1} max={25} defaultValue={8} />
              </label>

              <label className="full-width">
                Access Token (optional)
                <input name="token" type="password" placeholder="Needed for private repositories" />
              </label>

              <div className="checkbox-row full-width">
                <label>
                  <input type="checkbox" name="isPrivate" /> Private repository
                </label>

                <label>
                  <input type="checkbox" name="enabled" defaultChecked /> Enabled in public feed
                </label>
              </div>

              <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Adding Source...">
                Add Source
              </FormSubmitButton>
            </form>
          </section>

          <section className="admin-list-block">
            <div className="admin-list-header">
              <h2>Repository Sources</h2>
              <span>{sources.length} total</span>
            </div>

            <section className="admin-list admin-source-list">
              {sources.length === 0 ? (
                <div className="empty-state">No source connected yet.</div>
              ) : (
                sources.map((source) => {
                  const sourcePage = pages.find((page) => page.id === source.pageId);

                  return (
                    <article className="admin-card admin-source-card" key={source.id}>
                      <div className="admin-card-top">
                        <div className="admin-title-stack">
                          <h3>{source.displayName}</h3>
                          <p className="admin-subtle">
                            {source.owner}/{source.repo}
                          </p>
                        </div>

                        <div className="admin-tags" aria-label="Source status">
                          <span>{source.provider}</span>
                          <span>{source.isPrivate ? "private" : "public"}</span>
                          <span>{source.enabled ? "enabled" : "disabled"}</span>
                          <span>{sourcePage ? `/${sourcePage.pathName}` : "unassigned"}</span>
                        </div>
                      </div>

                      <form action={updateSourceAction} className="admin-grid two-col">
                        <input type="hidden" name="id" value={source.id} />

                        <label>
                          Changelog Page
                          <select name="pageId" defaultValue={source.pageId}>
                            {pages.map((page) => {
                              return (
                                <option key={page.id} value={page.id}>
                                  {page.name} (/{page.pathName})
                                </option>
                              );
                            })}
                          </select>
                        </label>

                        <label>
                          Provider
                          <select name="provider" defaultValue={source.provider}>
                            <option value="github">GitHub</option>
                            <option value="gitlab">GitLab</option>
                            <option value="bitbucket">Bitbucket</option>
                            <option value="gitea">Gitea</option>
                          </select>
                        </label>

                        <label>
                          Display Name
                          <input name="displayName" defaultValue={source.displayName} required />
                        </label>

                        <label>
                          Owner / Org / Workspace
                          <input name="owner" defaultValue={source.owner} required />
                        </label>

                        <label>
                          Repository
                          <input name="repo" defaultValue={source.repo} required />
                        </label>

                        <label>
                          Base URL (optional)
                          <input name="baseUrl" defaultValue={source.baseUrl ?? ""} placeholder="Provider API or host URL" />
                        </label>

                        <label>
                          Releases to fetch
                          <input
                            name="releasesLimit"
                            type="number"
                            min={1}
                            max={25}
                            defaultValue={source.releasesLimit}
                          />
                        </label>

                        <label className="full-width">
                          Replace token (leave blank to keep existing)
                          <input
                            name="token"
                            type="password"
                            placeholder={source.hasToken ? "Stored token exists" : "No token configured"}
                          />
                        </label>

                        <div className="checkbox-row full-width">
                          <label>
                            <input type="checkbox" name="isPrivate" defaultChecked={source.isPrivate} /> Private repository
                          </label>

                          <label>
                            <input type="checkbox" name="enabled" defaultChecked={source.enabled} /> Enabled
                          </label>

                          <label>
                            <input type="checkbox" name="clearToken" /> Remove saved token
                          </label>
                        </div>

                        <div className="admin-inline-actions full-width">
                          <FormSubmitButton className="primary-btn" type="submit" pendingLabel="Saving...">
                            Save Changes
                          </FormSubmitButton>
                        </div>
                      </form>

                      <form action={deleteSourceAction} className="inline-form">
                        <input type="hidden" name="id" value={source.id} />
                        <FormSubmitButton type="submit" className="danger-btn" pendingLabel="Deleting...">
                          Delete Source
                        </FormSubmitButton>
                      </form>
                    </article>
                  );
                })
              )}
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}
