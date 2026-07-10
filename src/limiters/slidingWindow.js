import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import client from "../redis/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(
  join(__dirname, "../redis/scripts/slidingWindow.lua"),
  "utf-8",
);

export const checkSlidingWindow = async (ip, path, limit, windowSec) => {
  const key = `ratelimit:window:${ip}:${path}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;

  // The Lua script now returns a table: { allowed, remaining, resetAt }
  const [allowed, remaining, resetAt] = await client.eval(
    script,
    1,
    key,
    now,
    windowMs,
    limit,
  );

  return { allowed, remaining, resetAt };
};
