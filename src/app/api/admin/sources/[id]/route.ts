import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRepoSource, updateRepoSource } from "@/lib/db";
import { invalidateChangelogCache } from "@/lib/changelog";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const updateSchema = z.object({
  pageId: z.string().min(1),
  displayName: z.string().min(2),
  provider: z.enum(["github", "gitlab", "bitbucket", "gitea"]).default("github"),
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseUrl: z.string().optional(),
  isPrivate: z.boolean().default(false),
  enabled: z.boolean().default(true),
  releasesLimit: z.number().int().min(1).max(25).default(8),
  token: z.string().optional().nullable()
});

export async function PATCH(request: Request, context: { params: { id: string } }): Promise<Response> {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = context.params;
  const body = await request.json();

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = updateRepoSource({
    id: params.id,
    ...parsed.data,
    baseUrl: parsed.data.baseUrl?.trim() || null,
    token: parsed.data.token === undefined ? undefined : parsed.data.token?.trim() || null
  });

  invalidateChangelogCache();
  return NextResponse.json({ source });
}

export async function DELETE(_: Request, context: { params: { id: string } }): Promise<Response> {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = context.params;
  deleteRepoSource(params.id);
  invalidateChangelogCache();

  return NextResponse.json({ ok: true });
}
