export async function fetchWithRetry(url: string | URL, init?: RequestInit, maxRetries = 3): Promise<Response> {
  const baseWaitMs = 1500;
  let attempt = 0;

  while (attempt <= maxRetries) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (e) {
      if (attempt === maxRetries) {
        throw e;
      }
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, baseWaitMs * Math.pow(2, attempt - 1)));
      continue;
    }

    if (response.ok) {
      return response;
    }

    // Rate limits (GitHub usually 403, standard 429)
    if (response.status === 403 || response.status === 429) {

      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      const isRateLimited = rateLimitRemaining === "0" || response.status === 429;

      if (isRateLimited) {
        if (attempt === maxRetries) {
          return response;
        }

        // See if github told us exactly when it resets.
        const resetAt = response.headers.get("x-ratelimit-reset");
        if (resetAt) {
          const resetTimeMs = parseInt(resetAt, 10) * 1000;
          const now = Date.now();
          const waitTimeStr = resetTimeMs > now ? resetTimeMs - now : baseWaitMs;

          // Only wait up to 10 seconds. If it's resetting in an hour, just fail normally so we don't block the request pool blindly.
          if (waitTimeStr < 10000) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, waitTimeStr + 500)); // buffer 500ms
            continue;
          } else {
            return response; // Exit early, wait is too long
          }
        }
      }

      if (attempt === maxRetries) {
        return response;
      }
    } else {
      // Not a rate limit issue or 5xx, don't retry standard 400/401/404s
      if (response.status >= 400 && response.status < 500 && response.status !== 403 && response.status !== 429) {
        return response;
      }

      if (attempt === maxRetries) {
        return response;
      }
    }

    attempt++;
    const jitter = Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, (baseWaitMs * Math.pow(2, attempt - 1)) + jitter));
  }

  throw new Error("Maximum retries exhausted");
}
