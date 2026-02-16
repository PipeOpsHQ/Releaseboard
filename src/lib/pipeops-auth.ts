function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

const DEFAULT_PIPEOPS_SIGNIN_URL = "https://pipeops.sh/auth/signin";

export function getPipeOpsSignInUrl(path = "/"): string {
  const configured = process.env.PIPEOPS_SIGNIN_URL?.trim() || DEFAULT_PIPEOPS_SIGNIN_URL;

  const returnTo = new URL(path, getAppBaseUrl()).toString();

  try {
    const url = new URL(configured.replace("{returnTo}", encodeURIComponent(returnTo)));
    if (!url.searchParams.has("return_to") && !url.searchParams.has("redirect_uri")) {
      url.searchParams.set("return_to", returnTo);
    }
    return url.toString();
  } catch {
    const fallback = new URL(DEFAULT_PIPEOPS_SIGNIN_URL);
    fallback.searchParams.set("return_to", returnTo);
    return fallback.toString();
  }
}
