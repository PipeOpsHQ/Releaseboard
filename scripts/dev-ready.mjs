import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const baseUrl = `http://${host}:${port}`;
const warmRoutes = ["/", "/changelog", "/landing", "/admin"];
const maxRouteRetries = 45;
const maxAssetRetries = 20;

function log(message) {
  process.stdout.write(`[dev-ready] ${message}\n`);
}

function parseStaticAssets(html) {
  const assets = new Set();
  const assetRegex = /(?:href|src)="(\/_next\/static\/[^"]+)"/g;
  for (const match of html.matchAll(assetRegex)) {
    if (match[1]) {
      assets.add(match[1]);
    }
  }
  return Array.from(assets);
}

async function fetchWithRetry(path, retries, retryDelayMs) {
  const url = `${baseUrl}${path}`;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // Ignore and retry while dev server starts.
    }

    if (attempt < retries) {
      await delay(retryDelayMs);
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function warmRoute(routePath) {
  const response = await fetchWithRetry(routePath, maxRouteRetries, 250);
  const html = await response.text();
  const assets = parseStaticAssets(html);

  for (const asset of assets) {
    await fetchWithRetry(asset, maxAssetRetries, 200);
  }
}

const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const nextPath = `./node_modules/.bin/${nextBin}`;
const passthroughArgs = process.argv.slice(2);
const child = spawn(nextPath, ["dev", "-p", String(port), ...passthroughArgs], {
  stdio: "inherit",
  env: process.env,
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const warmupPromise = (async () => {
  try {
    log(`Waiting for dev server on ${baseUrl}`);
    await fetchWithRetry("/", maxRouteRetries, 250);

    for (const routePath of warmRoutes) {
      log(`Prewarming ${routePath}`);
      await warmRoute(routePath);
    }

    log("Warmup complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Warmup skipped: ${message}`);
  }
})();

child.on("exit", (code, signal) => {
  warmupPromise.finally(() => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
});
