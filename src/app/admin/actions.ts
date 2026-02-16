"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createChangelogPage,
  createRepoSource,
  deleteChangelogPage,
  deleteRepoSource,
  listChangelogPages,
  setRootPageMode,
  updateChangelogPage,
  updateRepoSource
} from "@/lib/db";
import { invalidateChangelogCache } from "@/lib/changelog";
import { loginAdmin, logoutAdmin, requireAdminOrThrow } from "@/lib/admin-auth";

const sourceSchema = z.object({
  pageId: z.string().min(1),
  displayName: z.string().min(2),
  provider: z.enum(["github", "gitlab", "bitbucket", "gitea"]),
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseUrl: z.string().optional(),
  isPrivate: z.boolean(),
  enabled: z.boolean(),
  releasesLimit: z.number().int().min(1).max(25)
});

const changelogPageSchema = z.object({
  name: z.string().min(2),
  pathName: z.string().min(1),
  customDomain: z.string().optional()
});

const rootPageSchema = z.enum(["landing", "changelog"]);

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "1" || value === "true";
}

function parseReleasesLimit(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 8;
  }
  return Math.min(25, Math.max(1, parsed));
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const success = await loginAdmin(password);

  if (!success) {
    throw new Error("Invalid admin password");
  }

  revalidatePath("/admin");
}

export async function logoutAction(): Promise<void> {
  await logoutAdmin();
  revalidatePath("/admin");
}

export async function createSourceAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const parsed = sourceSchema.safeParse({
    pageId: String(formData.get("pageId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    provider: String(formData.get("provider") ?? "github").trim(),
    owner: String(formData.get("owner") ?? "").trim(),
    repo: String(formData.get("repo") ?? "").trim(),
    baseUrl: String(formData.get("baseUrl") ?? "").trim(),
    isPrivate: parseBoolean(formData.get("isPrivate")),
    enabled: parseBoolean(formData.get("enabled")),
    releasesLimit: parseReleasesLimit(formData.get("releasesLimit"))
  });

  if (!parsed.success) {
    throw new Error("Invalid source input");
  }

  const token = String(formData.get("token") ?? "").trim();

  createRepoSource({
    ...parsed.data,
    baseUrl: parsed.data.baseUrl?.trim() || null,
    token: token || null
  });

  invalidateChangelogCache();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function updateSourceAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Missing source id");
  }

  const parsed = sourceSchema.safeParse({
    pageId: String(formData.get("pageId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    provider: String(formData.get("provider") ?? "github").trim(),
    owner: String(formData.get("owner") ?? "").trim(),
    repo: String(formData.get("repo") ?? "").trim(),
    baseUrl: String(formData.get("baseUrl") ?? "").trim(),
    isPrivate: parseBoolean(formData.get("isPrivate")),
    enabled: parseBoolean(formData.get("enabled")),
    releasesLimit: parseReleasesLimit(formData.get("releasesLimit"))
  });

  if (!parsed.success) {
    throw new Error("Invalid source input");
  }

  const tokenInput = String(formData.get("token") ?? "").trim();
  const clearToken = parseBoolean(formData.get("clearToken"));

  const token = clearToken ? null : tokenInput ? tokenInput : undefined;

  updateRepoSource({
    id,
    ...parsed.data,
    baseUrl: parsed.data.baseUrl?.trim() || null,
    token
  });

  invalidateChangelogCache();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function deleteSourceAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Missing source id");
  }

  deleteRepoSource(id);
  invalidateChangelogCache();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function refreshAction(): Promise<void> {
  await requireAdminOrThrow();

  invalidateChangelogCache();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function updateRootPageAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const parsed = rootPageSchema.safeParse(String(formData.get("rootPage") ?? "").trim());
  if (!parsed.success) {
    throw new Error("Invalid root page mode");
  }

  setRootPageMode(parsed.data);

  revalidatePath("/");
  revalidatePath("/landing");
  revalidatePath("/changelog");
  revalidatePath("/admin");
}

export async function createChangelogPageAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const parsed = changelogPageSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    pathName: String(formData.get("pathName") ?? "").trim(),
    customDomain: String(formData.get("customDomain") ?? "").trim()
  });

  if (!parsed.success) {
    throw new Error("Invalid changelog page input");
  }

  createChangelogPage({
    name: parsed.data.name,
    pathName: parsed.data.pathName,
    customDomain: parsed.data.customDomain?.trim() || null
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function updateChangelogPageAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Missing page id");
  }

  const parsed = changelogPageSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    pathName: String(formData.get("pathName") ?? "").trim(),
    customDomain: String(formData.get("customDomain") ?? "").trim()
  });

  if (!parsed.success) {
    throw new Error("Invalid changelog page input");
  }

  updateChangelogPage({
    id,
    name: parsed.data.name,
    pathName: parsed.data.pathName,
    customDomain: parsed.data.customDomain?.trim() || null
  });

  invalidateChangelogCache();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}

export async function deleteChangelogPageAction(formData: FormData): Promise<void> {
  await requireAdminOrThrow();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Missing page id");
  }

  deleteChangelogPage(id);
  invalidateChangelogCache(id);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/changelog");

  const pages = listChangelogPages();
  for (const page of pages) {
    revalidatePath(`/${page.pathName}`);
  }
}
