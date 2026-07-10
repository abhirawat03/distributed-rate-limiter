import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import client from "../redis/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const script = readFileSync(
  join(__dirname, "../redis/scripts/tokenBucket.lua"),
  "utf-8",
);

export const tokenBucketLimiter = async (req, res, next) => {
  const key = `ratelimit:${req.ip}:${req.path}`;
  const now = Date.now();
  const capacity = 20; // max 20 tokens in bucket
  const refillRate = 0.33; // 0.33 tokens/sec = 20 per minute

  const result = await client.eval(script, 1, key, now, capacity, refillRate);

  if (result === 0) {
    return res.status(429).json({ error: "Too many requests" });
  }

  next();
};
