import { notFound } from "next/navigation";
import { ChangelogView } from "@/components/ChangelogView";
import { getChangelogPageByPath } from "@/lib/db";

interface ChangelogPathPageProps {
  params: Promise<{
    pathName: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ChangelogPathPage({ params }: ChangelogPathPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;
  const page = getChangelogPageByPath(resolvedParams.pathName);
  if (!page) {
    notFound();
  }

  return <ChangelogView pageId={page.id} pagePathName={page.pathName} pageName={page.name} />;
}
