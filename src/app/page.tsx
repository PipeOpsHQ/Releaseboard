import { headers } from "next/headers";
import { getAppSettings } from "@/lib/db";
import { LandingPage } from "@/components/LandingPage";
import { ChangelogView } from "@/components/ChangelogView";
import { getChangelogPageByDomain, getDefaultChangelogPage } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<JSX.Element> {
  const hostHeader = headers().get("host")?.toLowerCase() ?? "";
  const host = hostHeader.split(":")[0] || "";
  const domainPage = host ? getChangelogPageByDomain(host) : null;

  if (domainPage) {
    return <ChangelogView pageId={domainPage.id} pagePathName={domainPage.pathName} pageName={domainPage.name} />;
  }

  const settings = getAppSettings();

  if (settings.rootPage === "changelog") {
    const defaultPage = getDefaultChangelogPage();
    return <ChangelogView pageId={defaultPage.id} pagePathName={defaultPage.pathName} pageName={defaultPage.name} />;
  }

  return <LandingPage />;
}
