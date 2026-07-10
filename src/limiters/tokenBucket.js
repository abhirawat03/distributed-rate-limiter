import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import client from "../redis/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(
  join(__dirname, "../redis/scripts/tokenBucket.lua"),
  "utf-8",
);

export const checkTokenBucket = async (ip, path, capacity, refillPerSec) => {
  const key = `ratelimit:${ip}:${path}`;
  const now = Date.now();

  // The Lua script now returns a table: { allowed, remaining, resetAt }
  const [allowed, remaining, resetAt] = await client.eval(
    script,
    1,
    key,
    now,
    capacity,
    refillPerSec,
  );

  return { allowed, remaining, resetAt };
};
