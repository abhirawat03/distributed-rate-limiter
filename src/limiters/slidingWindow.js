import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import client from "../redis/client.js";

// ESM doesn't have __dirname — this is how you get it
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load Lua script once at startup (not on every request)
const script = readFileSync(
  join(__dirname, "../redis/scripts/slidingWindow.lua"),
  "utf-8",
);

export const slidingWindowLimiter = async (req, res, next) => {
  const key = `ratelimit:window:${req.ip}:${req.path}`;
  const now = Date.now(); // current time in ms
  const windowMs = 60 * 1000; // 60 seconds in ms
  const limit = 5;

  // eval runs the Lua script atomically on Redis
  // 1 = number of keys, then keys, then args
  const result = await client.eval(script, 1, key, now, windowMs, limit);

  if (result === 0) {
    return res.status(429).json({ error: "Too many requests" });
  }

  next();
};
