import { NextResponse } from "next/server";
import { z } from "zod";
import { createRepoSource, listRepoSources } from "@/lib/db";
import { invalidateChangelogCache } from "@/lib/changelog";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const sourceSchema = z.object({
  pageId: z.string().min(1),
  displayName: z.string().min(2),
  provider: z.enum(["github", "gitlab", "bitbucket", "gitea"]).default("github"),
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseUrl: z.string().optional(),
  isPrivate: z.boolean().default(false),
  token: z.string().optional(),
  enabled: z.boolean().default(true),
  releasesLimit: z.number().int().min(1).max(25).default(8)
});

export async function GET(): Promise<Response> {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ sources: listRepoSources() });
}

export async function POST(request: Request): Promise<Response> {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = sourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = createRepoSource({
    ...parsed.data,
    baseUrl: parsed.data.baseUrl?.trim() || null,
    token: parsed.data.token?.trim() || null
  });

  invalidateChangelogCache();
  return NextResponse.json({ source }, { status: 201 });
}
