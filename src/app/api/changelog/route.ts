import { NextResponse } from "next/server";
import { getUnifiedChangelog } from "@/lib/changelog";
import { getChangelogPageByDomain, getChangelogPageByPath, getDefaultChangelogPage } from "@/lib/db";

function isAuthorized(request: Request): boolean {
  const expectedApiKey = process.env.CHANGELOG_API_KEY?.trim();
  if (!expectedApiKey) {
    return true;
  }

  const headerApiKey = request.headers.get("x-api-key")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  return headerApiKey === expectedApiKey || bearerToken === expectedApiKey;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const { searchParams } = url;
  const forceRefresh = searchParams.get("force") === "1";
  const pathParam = searchParams.get("path")?.trim();
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";

  const page =
    (pathParam ? getChangelogPageByPath(pathParam) : null) ??
    (host ? getChangelogPageByDomain(host) : null) ??
    getDefaultChangelogPage();

  const payload = await getUnifiedChangelog({ forceRefresh, pageId: page.id });
  return NextResponse.json({
    page,
    ...payload
  });
}
