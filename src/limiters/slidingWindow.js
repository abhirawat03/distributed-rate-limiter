import client from "../redis/client.js";

export const checkSlidingWindow = async (ip, path, limit, windowSec) => {
  const key = `ratelimit:window:${ip}:${path}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;

  // Call the custom command (runs EVALSHA under the hood)
  const [allowed, remaining, resetAt] = await client.checkSlidingWindowLua(
    key,
    now,
    windowMs,
    limit,
  );

  return { allowed, remaining, resetAt };
};
