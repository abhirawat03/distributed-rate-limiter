import client from "../redis/client.js";

export const naiveLimiter = async (req, res, next) => {
  const key = `ratelimit:${req.ip}:${req.path}`;
  // unique per IP + route
  const limit = 5; // max 5 requests
  const windowSec = 60; // per 60 seconds

  const count = await client.get(key); // Step 1: GET current count
  if (count !== null && parseInt(count) >= limit) {
    return res.status(429).json({ error: "Too many requests" });
  }

  await client.incr(key); // Step 2: INCR (separate operation!)

  if (count === null) {
    await client.expire(key, windowSec); // Set expiry only on first request
  }

  next();
};
