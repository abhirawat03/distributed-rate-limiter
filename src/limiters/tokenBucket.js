import client from "../redis/client.js";

export const checkTokenBucket = async (ip, path, capacity, refillPerSec) => {
  const key = `ratelimit:${ip}:${path}`;
  const now = Date.now();

  // Call the custom command (runs EVALSHA under the hood)
  const [allowed, remaining, resetAt] = await client.checkTokenBucketLua(
    key,
    now,
    capacity,
    refillPerSec,
  );

  return { allowed, remaining, resetAt };
};
